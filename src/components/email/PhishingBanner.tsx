import { useState } from "react";
import { AlertTriangle, ShieldAlert, ShieldCheck, X } from "lucide-react";
import type { LinkAnalysis, PhishingRiskLevel } from "../../types";

interface PhishingBannerProps {
  analyses: LinkAnalysis[];
  overallRisk: PhishingRiskLevel;
  onTrustSender: () => Promise<void> | void;
  onReport: () => void;
}

export function PhishingBanner({
  analyses,
  overallRisk,
  onTrustSender,
  onReport,
}: PhishingBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || overallRisk === "safe") return null;

  const riskyLinks = analyses.filter((a) => a.riskLevel !== "safe");
  const allReasons = riskyLinks.flatMap((a) => a.reasons);
  const uniqueReasons = [...new Set(allReasons)];

  const isDanger = overallRisk === "danger";

  return (
    <div
      className={`mx-6 mb-3 rounded-lg border px-4 py-3 ${
        isDanger
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
          : "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40"
      }`}
      data-testid="phishing-banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {isDanger ? (
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          )}
          <div className="min-w-0">
            <p
              className={`text-sm font-medium ${
                isDanger
                  ? "text-red-800 dark:text-red-300"
                  : "text-yellow-800 dark:text-yellow-300"
              }`}
            >
              {isDanger
                ? "This message contains suspicious links"
                : "Some links in this message need attention"}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {uniqueReasons.map((reason, i) => (
                <li
                  key={i}
                  className={`text-xs ${
                    isDanger
                      ? "text-red-700 dark:text-red-400"
                      : "text-yellow-700 dark:text-yellow-400"
                  }`}
                >
                  {reason}
                </li>
              ))}
            </ul>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={onReport}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  isDanger
                    ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
                    : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900"
                }`}
                data-testid="phishing-report-btn"
              >
                Report
              </button>
              <button
                onClick={onTrustSender}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover"
                data-testid="phishing-trust-btn"
              >
                <ShieldCheck className="mr-1 inline-block h-3 w-3" />
                I trust this sender
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 rounded-md p-1 text-text-tertiary hover:bg-bg-hover"
          data-testid="phishing-dismiss-btn"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
