import { useTranslation } from "react-i18next";
import { useLicenseStore } from "../../../stores/licenseStore";
import { ActivationPage } from "../../license/ActivationPage";
import { Section } from "./shared";

export function LicenseSection() {
  const { t } = useTranslation();
  const status = useLicenseStore((s) => s.status);
  const trialDaysLeft = useLicenseStore((s) => s.trialDaysLeft);
  const licenseKey = useLicenseStore((s) => s.licenseKey);
  const deactivate = useLicenseStore((s) => s.deactivate);

  const statusLabel =
    status === "licensed"
      ? t("license.statusLicensed")
      : status === "trial"
        ? t("license.statusTrial", { count: trialDaysLeft })
        : t("license.statusExpired");

  return (
    <Section title={t("license.settingsTitle")}>
      <div className="flex items-center gap-2" data-testid="license-status">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            status === "licensed" ? "bg-green-500" : "bg-amber-500"
          }`}
        />
        <span className="text-sm text-text-primary">{statusLabel}</span>
      </div>

      {status === "licensed" ? (
        <div className="mt-3 space-y-3">
          {licenseKey && (
            <p className="text-xs text-text-tertiary">
              {t("license.keyLabel")}: ••••{licenseKey.slice(-6)}
            </p>
          )}
          <button
            onClick={() => void deactivate()}
            className="rounded-lg border border-border-primary px-4 py-2 text-sm text-danger hover:bg-bg-hover"
            data-testid="license-deactivate-button"
          >
            {t("license.deactivate")}
          </button>
        </div>
      ) : (
        <div className="mt-3 max-w-sm">
          <p className="mb-3 text-xs text-text-tertiary">{t("license.manageHint")}</p>
          <ActivationPage embedded />
        </div>
      )}
    </Section>
  );
}
