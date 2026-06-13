import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

/** Slim banner shown during the free trial with days remaining and CTAs. */
export function TrialBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const daysLeft = useLicenseStore((s) => s.trialDaysLeft);

  return (
    <div
      className="flex items-center justify-center gap-3 bg-accent px-4 py-1.5 text-xs text-white"
      data-testid="trial-banner"
    >
      <span>{t("license.trialBanner", { count: daysLeft })}</span>
      <button
        onClick={() => void openBuyPage()}
        className="rounded bg-white/20 px-2 py-0.5 font-medium hover:bg-white/30"
        data-testid="trial-buy-button"
      >
        {t("license.buy")}
      </button>
      <button
        onClick={() => navigate("/settings")}
        className="font-medium underline underline-offset-2 hover:opacity-80"
        data-testid="trial-enter-key-button"
      >
        {t("license.enterKey")}
      </button>
    </div>
  );
}
