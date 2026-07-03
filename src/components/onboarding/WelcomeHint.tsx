import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Command, Keyboard, X } from "lucide-react";
import { getDb } from "../../services/db/connection";

const SEEN_KEY = "welcome_hint_seen";

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

async function readSeen(): Promise<boolean> {
  try {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = $1",
      [SEEN_KEY],
    );
    return rows[0]?.value === "1";
  } catch {
    return false;
  }
}

async function markSeen(): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, '1') ON CONFLICT(key) DO UPDATE SET value = '1'",
      [SEEN_KEY],
    );
  } catch {
    // Best-effort — a failure just means the hint may show again next launch.
  }
}

/**
 * A one-time, dismissable first-run hint surfacing the two keyboard entry points
 * (command palette + shortcuts) — otherwise a new user has no way to discover
 * the keyboard-first workflow that is Fumi's core value. Shown once, then never
 * again (persisted in settings).
 */
export function WelcomeHint() {
  const { t } = useTranslation();
  // null = still checking; avoids a flash before we know whether to show it.
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    void readSeen().then((seen) => setVisible(!seen));
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    void markSeen();
  }, []);

  if (visible !== true) return null;

  const searchKeys = isMac() ? "⌘K" : "Ctrl+K";

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-border-primary bg-bg-primary p-4 shadow-xl"
      data-testid="welcome-hint"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("welcome.title")}
        </h3>
        <button
          onClick={dismiss}
          className="rounded p-0.5 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          aria-label={t("welcome.dismiss")}
          data-testid="welcome-hint-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="mt-3 space-y-2 text-sm text-text-secondary">
        <li className="flex items-center gap-2">
          <Command className="h-4 w-4 shrink-0 text-text-tertiary" />
          <span className="flex-1">{t("welcome.searchLabel")}</span>
          <kbd className="rounded border border-border-primary bg-bg-secondary px-1.5 py-0.5 text-xs text-text-primary">
            {searchKeys}
          </kbd>
        </li>
        <li className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 shrink-0 text-text-tertiary" />
          <span className="flex-1">{t("welcome.shortcutsLabel")}</span>
          <kbd className="rounded border border-border-primary bg-bg-secondary px-1.5 py-0.5 text-xs text-text-primary">
            ?
          </kbd>
        </li>
      </ul>

      <div className="mt-3 flex justify-end">
        <button
          onClick={dismiss}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          data-testid="welcome-hint-dismiss"
        >
          {t("welcome.dismiss")}
        </button>
      </div>
    </div>
  );
}
