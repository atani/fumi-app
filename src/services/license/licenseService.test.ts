import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stateful in-memory settings table so activate/validate/deactivate/trial paths
// exercise real persistence (the MemoryDb fallback is a no-op and cannot seed).
const settings = new Map<string, string>();

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: async (_sql: string, params: string[]) => {
      const value = settings.get(String(params[0]));
      return value === undefined ? [] : [{ value }];
    },
    execute: async (sql: string, params: string[]) => {
      if (sql.trimStart().toUpperCase().startsWith("INSERT")) {
        settings.set(String(params[0]), String(params[1]));
      } else if (sql.trimStart().toUpperCase().startsWith("DELETE")) {
        settings.delete(String(params[0]));
      }
      return { rowsAffected: 1 };
    },
  }),
}));

const {
  TRIAL_DAYS,
  trialDaysLeft,
  getTrialStart,
  activateLicense,
  validateStoredLicense,
  deactivateLicense,
  getStoredLicense,
} = await import("./licenseService");

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  settings.clear();
  // Note: do NOT call vi.restoreAllMocks()/resetAllMocks() here — it would wipe
  // the mocked getDb implementation and silently break all persistence.
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("trialDaysLeft", () => {
  const start = 1_000_000_000_000;

  it("returns the full trial on day zero", () => {
    expect(trialDaysLeft(start, start)).toBe(TRIAL_DAYS);
  });

  it("counts down as time passes", () => {
    expect(trialDaysLeft(start, start + 3 * DAY_MS)).toBe(TRIAL_DAYS - 3);
  });

  // The exact boundary is what flips 'trial' → hard paywall. Guard the off-by-one.
  it("returns 0 at the exact end of the trial", () => {
    expect(trialDaysLeft(start, start + TRIAL_DAYS * DAY_MS)).toBe(0);
  });

  it("returns 1 one millisecond before the end", () => {
    expect(trialDaysLeft(start, start + TRIAL_DAYS * DAY_MS - 1)).toBe(1);
  });

  it("never returns negative", () => {
    expect(trialDaysLeft(start, start + 999 * DAY_MS)).toBe(0);
  });
});

describe("getTrialStart", () => {
  it("creates and persists a start timestamp on first call", async () => {
    expect(settings.has("trial_started_at")).toBe(false);
    const t = await getTrialStart();
    expect(typeof t).toBe("number");
    expect(settings.get("trial_started_at")).toBe(String(t));
  });

  it("returns the existing timestamp without overwriting it", async () => {
    settings.set("trial_started_at", "1234567890");
    const t = await getTrialStart();
    expect(t).toBe(1234567890);
    expect(settings.get("trial_started_at")).toBe("1234567890");
  });

  it("resets when the stored value is corrupt", async () => {
    settings.set("trial_started_at", "not-a-number");
    const t = await getTrialStart();
    expect(Number.isNaN(t)).toBe(false);
    expect(settings.get("trial_started_at")).toBe(String(t));
  });
});

describe("activateLicense", () => {
  it("rejects an empty key without calling the API", async () => {
    const fetchMock = stubFetch();
    const result = await activateLicense("   ");
    expect(result).toEqual({ ok: false, reason: "invalid_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("persists key + instance id on success", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue({
      json: async () => ({ activated: true, instance: { id: "inst-1" }, meta: {} }),
    });

    const result = await activateLicense("VALID-KEY");

    expect(result.ok).toBe(true);
    // Revenue contract: without persistence the user pays, looks licensed, then
    // falls back to the paywall on next launch.
    expect(settings.get("license_key")).toBe("VALID-KEY");
    expect(settings.get("license_instance_id")).toBe("inst-1");
    expect(settings.has("license_validated_at")).toBe(true);
    const stored = await getStoredLicense();
    expect(stored).toEqual({ key: "VALID-KEY", instanceId: "inst-1" });
  });

  it("fails with invalid_key and persists nothing when the server declines", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue({
      json: async () => ({ activated: false, error: "license_key not found" }),
    });

    const result = await activateLicense("BAD-KEY");

    expect(result).toEqual({ ok: false, reason: "invalid_key" });
    expect(settings.has("license_key")).toBe(false);
  });

  it("reports a network reason when the request throws", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(new Error("offline"));
    const result = await activateLicense("ANY-KEY");
    expect(result).toEqual({ ok: false, reason: "network" });
    expect(settings.has("license_key")).toBe(false);
  });
});

describe("validateStoredLicense", () => {
  it("returns false when no license is stored", async () => {
    stubFetch();
    expect(await validateStoredLicense()).toBe(false);
  });

  function seedLicense() {
    settings.set("license_key", "K");
    settings.set("license_instance_id", "I");
    settings.set("license_validated_at", "1");
  }

  it("keeps a stored license valid when the server is unreachable (offline grace)", async () => {
    seedLicense();
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(new Error("offline"));

    // A regression here locks out a paying customer on flaky wifi.
    expect(await validateStoredLicense()).toBe(true);
    expect(settings.get("license_key")).toBe("K");
  });

  it("stays valid and refreshes the timestamp when the server says valid", async () => {
    seedLicense();
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue({ json: async () => ({ valid: true, meta: {} }) });

    expect(await validateStoredLicense()).toBe(true);
    expect(settings.get("license_key")).toBe("K");
  });

  it("clears the local license when the server says invalid", async () => {
    seedLicense();
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValue({ json: async () => ({ valid: false }) });

    expect(await validateStoredLicense()).toBe(false);
    expect(settings.has("license_key")).toBe(false);
    expect(settings.has("license_instance_id")).toBe(false);
    expect(settings.has("license_validated_at")).toBe(false);
  });
});

describe("deactivateLicense", () => {
  it("clears local state even when the deactivate request throws", async () => {
    settings.set("license_key", "K");
    settings.set("license_instance_id", "I");
    settings.set("license_validated_at", "1");
    const fetchMock = stubFetch();
    fetchMock.mockRejectedValue(new Error("offline"));

    await deactivateLicense();

    expect(settings.has("license_key")).toBe(false);
    expect(settings.has("license_instance_id")).toBe(false);
    expect(settings.has("license_validated_at")).toBe(false);
  });
});
