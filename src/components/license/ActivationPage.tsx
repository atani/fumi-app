import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { useLicenseStore } from "../../stores/licenseStore";

const BUY_URL = (import.meta.env.VITE_BUY_URL ?? "https://fumi.app").trim();

async function openBuyPage(): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(BUY_URL);
  } else {
    window.open(BUY_URL, "_blank", "noopener");
  }
}

/**
 * License activation screen. Shown full-screen when the trial has expired, and
 * reusable inside settings via `embedded`.
 */
export function ActivationPage({
  expired = false,
  embedded = false,
}: {
  expired?: boolean;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const activate = useLicenseStore((s) => s.activate);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    const result = await activate(key);
    if (!result.ok) {
      const map: Record<string, string> = {
        invalid_key: t("license.errorInvalid"),
        wrong_product: t("license.errorWrongProduct"),
        network: t("license.errorNetwork"),
      };
      setError(map[result.reason ?? "invalid_key"] ?? t("license.errorInvalid"));
    }
    setBusy(false);
  };

  const form = (
    <div className="space-y-3">
      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={t("license.keyPlaceholder")}
        className="w-full rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="license-key-input"
      />
      <button
        onClick={() => void handleActivate()}
        disabled={busy || !key.trim()}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        data-testid="license-activate-button"
      >
        {busy ? t("license.activating") : t("license.activate")}
      </button>
      <button
        onClick={() => void openBuyPage()}
        className="w-full rounded-lg border border-border-primary px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-hover"
        data-testid="license-buy-button"
      >
        {t("license.buy")}
      </button>
      {error && (
        <p className="text-center text-sm text-danger" data-testid="license-error">
          {error}
        </p>
      )}
    </div>
  );

  if (embedded) return form;

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      <div
        className="h-10 w-full shrink-0"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm px-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light">
              <Mail className="h-8 w-8 text-accent" />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-text-primary">
              {expired ? t("license.expiredTitle") : t("license.activateTitle")}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              {expired ? t("license.expiredSubtitle") : t("license.activateSubtitle")}
            </p>
          </div>
          <div className="mt-8">{form}</div>
        </div>
      </div>
    </div>
  );
}
