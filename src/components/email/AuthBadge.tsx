import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield } from "lucide-react";
import type { AuthResult } from "../../types";

interface AuthBadgeProps {
  authResult: AuthResult;
}

function statusIcon(status: string) {
  if (status === "pass") return "pass";
  if (status === "fail") return "fail";
  if (status === "none") return "none";
  return "unknown";
}

function statusLabelKey(status: string): string {
  if (status === "pass") return "email.auth.pass";
  if (status === "fail") return "email.auth.fail";
  if (status === "none") return "email.auth.none";
  return "email.auth.unknown";
}

function statusColor(status: string): string {
  if (status === "pass") return "text-green-600 dark:text-green-400";
  if (status === "fail") return "text-red-600 dark:text-red-400";
  if (status === "none") return "text-text-tertiary";
  return "text-text-tertiary";
}

export function AuthBadge({ authResult }: AuthBadgeProps) {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const { verdict } = authResult;

  // Do not render anything if we have no auth data at all
  if (verdict === "unknown") return null;

  const Icon =
    verdict === "pass"
      ? ShieldCheck
      : verdict === "fail"
        ? ShieldAlert
        : verdict === "warning"
          ? Shield
          : ShieldQuestion;

  const colorClass =
    verdict === "pass"
      ? "text-green-600 dark:text-green-400"
      : verdict === "fail"
        ? "text-red-600 dark:text-red-400"
        : "text-yellow-600 dark:text-yellow-400";

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Icon
        className={`h-4 w-4 ${colorClass}`}
        data-testid="auth-badge-icon"
      />

      {showTooltip && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 rounded-lg border border-border-primary bg-bg-primary px-3 py-2 shadow-lg"
          data-testid="auth-badge-tooltip"
        >
          <p className="mb-1.5 whitespace-nowrap text-xs font-medium text-text-primary">
            {t("email.auth.heading")}
          </p>
          <div className="space-y-1">
            {(["spf", "dkim", "dmarc"] as const).map((key) => {
              const status = authResult[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 whitespace-nowrap text-xs"
                >
                  <span className="font-mono uppercase text-text-secondary">
                    {key}
                  </span>
                  <span className={`font-medium ${statusColor(statusIcon(status))}`}>
                    {t(statusLabelKey(status))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
