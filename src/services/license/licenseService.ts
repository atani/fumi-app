/**
 * Buy-once license activation for Fumi, backed by the Lemon Squeezy License API.
 *
 * Lemon Squeezy issues one license key per purchase. The activate/validate/
 * deactivate endpoints are keyed by the license key itself and require no store
 * API token, so they are safe to call from the client. When the store/product
 * IDs are configured at build time, activation additionally verifies that the
 * key belongs to THIS product (so a key from another product can't unlock Fumi).
 *
 * All license state is stored locally in the `settings` table. A time-limited
 * free trial runs from first launch; after it ends an active license is
 * required. To avoid locking out paying users while offline, a previously
 * activated license stays valid unless the server explicitly reports it as
 * invalid/deactivated.
 */
import { getDb } from "../db/connection";

const LS_API = "https://api.lemonsqueezy.com/v1/licenses";

export const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const EXPECTED_STORE_ID = (import.meta.env.VITE_LEMONSQUEEZY_STORE_ID ?? "").trim();
const EXPECTED_PRODUCT_ID = (import.meta.env.VITE_LEMONSQUEEZY_PRODUCT_ID ?? "").trim();

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

interface LsActivateResponse {
  activated?: boolean;
  valid?: boolean;
  error?: string | null;
  license_key?: { status?: string };
  instance?: { id?: string };
  meta?: { store_id?: number; product_id?: number };
}

/** POST to the Lemon Squeezy License API, using the Tauri HTTP client when available to avoid CORS. */
async function lsPost(path: string, body: Record<string, string>): Promise<LsActivateResponse> {
  const url = `${LS_API}/${path}`;
  const init: RequestInit = {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  };

  let res: Response;
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    res = await tauriFetch(url, init);
  } else {
    res = await fetch(url, init);
  }

  // Treat transient server errors (rate limit / 5xx) as a network failure so
  // callers keep an already-activated license instead of wrongly clearing it.
  // Definitive client responses (2xx / 4xx like 400/404 for a bad key) are
  // parsed so activate can distinguish an invalid key.
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`Lemon Squeezy licensing server error (${res.status})`);
  }
  return (await res.json()) as LsActivateResponse;
}

function productMatches(meta: LsActivateResponse["meta"]): boolean {
  if (EXPECTED_STORE_ID && String(meta?.store_id ?? "") !== EXPECTED_STORE_ID) return false;
  if (EXPECTED_PRODUCT_ID && String(meta?.product_id ?? "") !== EXPECTED_PRODUCT_ID) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Local settings persistence
// ---------------------------------------------------------------------------

async function getSetting(key: string): Promise<string | null> {
  try {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = $1",
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
      [key, value],
    );
  } catch (err) {
    // A failed write of a license/trial key means a paid activation may not
    // persist; leave a trace so a "paid but locked out" report is diagnosable.
    console.error(`Failed to persist license setting "${key}":`, err);
  }
}

async function deleteSetting(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.execute("DELETE FROM settings WHERE key = $1", [key]);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Trial
// ---------------------------------------------------------------------------

/** Returns the first-launch timestamp (ms), creating it on first call. */
export async function getTrialStart(): Promise<number> {
  const existing = await getSetting("trial_started_at");
  if (existing) {
    const parsed = parseInt(existing, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const now = Date.now();
  await setSetting("trial_started_at", String(now));
  return now;
}

/** Whole days left in the trial (0 once expired). */
export function trialDaysLeft(trialStart: number, now: number = Date.now()): number {
  const elapsed = now - trialStart;
  const remaining = TRIAL_DAYS * DAY_MS - elapsed;
  return remaining <= 0 ? 0 : Math.ceil(remaining / DAY_MS);
}

// ---------------------------------------------------------------------------
// License activation
// ---------------------------------------------------------------------------

export interface StoredLicense {
  key: string;
  instanceId: string;
}

export async function getStoredLicense(): Promise<StoredLicense | null> {
  const key = await getSetting("license_key");
  const instanceId = await getSetting("license_instance_id");
  if (key && instanceId) return { key, instanceId };
  return null;
}

export interface ActivateResult {
  ok: boolean;
  /** Machine-readable reason on failure: "invalid_key" | "wrong_product" | "network". */
  reason?: "invalid_key" | "wrong_product" | "network";
}

/** Activate a license key, binding it to this installation. */
export async function activateLicense(
  licenseKey: string,
  instanceName = "Fumi",
): Promise<ActivateResult> {
  const key = licenseKey.trim();
  if (!key) return { ok: false, reason: "invalid_key" };

  let res: LsActivateResponse;
  try {
    res = await lsPost("activate", { license_key: key, instance_name: instanceName });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (!res.activated || !res.instance?.id) {
    return { ok: false, reason: "invalid_key" };
  }
  if (!productMatches(res.meta)) {
    return { ok: false, reason: "wrong_product" };
  }

  await setSetting("license_key", key);
  await setSetting("license_instance_id", res.instance.id);
  await setSetting("license_validated_at", String(Date.now()));
  return { ok: true };
}

/**
 * Validate the stored license. Returns true if licensed. Network failures keep
 * a previously activated license valid (offline grace); only an explicit
 * invalid/deactivated response clears it.
 */
export async function validateStoredLicense(): Promise<boolean> {
  const stored = await getStoredLicense();
  if (!stored) return false;

  let res: LsActivateResponse;
  try {
    res = await lsPost("validate", {
      license_key: stored.key,
      instance_id: stored.instanceId,
    });
  } catch {
    return true; // offline / transient server error — don't lock out a paying user
  }

  // Only an explicit `valid: false` clears the license. Product verification
  // happens at activation time, not on every launch — re-checking `meta` here
  // would wrongly wipe a valid license when the validate response omits `meta`.
  if (res.valid === false) {
    console.warn("License reported invalid by server; clearing local license.");
    await deleteSetting("license_key");
    await deleteSetting("license_instance_id");
    await deleteSetting("license_validated_at");
    return false;
  }

  // valid === true, or an ambiguous response: keep the license (never lock out
  // a paying user on an unexpected payload).
  if (res.valid === true) {
    await setSetting("license_validated_at", String(Date.now()));
  }
  return true;
}

/** Deactivate this installation's license (frees a seat). */
export async function deactivateLicense(): Promise<void> {
  const stored = await getStoredLicense();
  if (stored) {
    try {
      await lsPost("deactivate", {
        license_key: stored.key,
        instance_id: stored.instanceId,
      });
    } catch {
      // best-effort
    }
  }
  await deleteSetting("license_key");
  await deleteSetting("license_instance_id");
  await deleteSetting("license_validated_at");
}
