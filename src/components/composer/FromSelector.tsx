import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { getSendAsAliases } from "../../services/gmail/sendAs";
import type { SendAsAlias } from "../../types";

interface FromSelectorProps {
  accountId: string;
  accountEmail: string;
  value: string;
  onChange: (email: string) => void;
}

export function FromSelector({ accountId, accountEmail, value, onChange }: FromSelectorProps) {
  const { t } = useTranslation();
  const [aliases, setAliases] = useState<SendAsAlias[]>([]);

  useEffect(() => {
    let cancelled = false;
    getSendAsAliases(accountId).then((result) => {
      if (!cancelled) setAliases(result);
    }).catch(() => {
      // Ignore — no aliases available
    });
    return () => { cancelled = true; };
  }, [accountId]);

  // Only show selector when there are multiple aliases
  if (aliases.length <= 1) return null;

  return (
    <div className="flex items-center border-b border-border-secondary px-4 py-1.5">
      <label className="w-12 shrink-0 text-xs text-text-tertiary">
        {t("composer.from")}
      </label>
      <div className="relative flex-1">
        <select
          className="w-full appearance-none bg-transparent pr-6 text-sm text-text-primary outline-none"
          value={value || accountEmail}
          onChange={(e) => onChange(e.target.value)}
        >
          {aliases.map((alias) => (
            <option key={alias.email} value={alias.email}>
              {alias.display_name
                ? `${alias.display_name} <${alias.email}>`
                : alias.email}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 text-text-tertiary" />
      </div>
    </div>
  );
}
