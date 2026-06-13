import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import { useComposerStore } from "../../stores/composerStore";
import { getAllTemplates } from "../../services/db/templates";
import type { Template } from "../../types";

export function TemplatePicker() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const { getActiveAccount } = useAccountStore();
  const { updateField } = useComposerStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const account = getActiveAccount();
    if (!account) return;

    getAllTemplates(account.id).then(setTemplates).catch(console.error);
  }, [isOpen, getActiveAccount]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSelect = (template: Template) => {
    if (template.subject) {
      updateField("subject", template.subject);
    }
    if (template.body) {
      updateField("body", template.body);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        onClick={() => setIsOpen(!isOpen)}
        title={t("composer.insertTemplate")}
        data-testid="template-picker-btn"
      >
        <FileText className="h-3.5 w-3.5" />
        {t("composer.templates")}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border border-border-primary bg-bg-primary shadow-lg">
          {templates.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-tertiary">
              {t("composer.noTemplates")}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto py-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-bg-hover"
                  onClick={() => handleSelect(t)}
                  data-testid={`template-option-${t.id}`}
                >
                  <span className="text-sm text-text-primary">{t.name}</span>
                  {t.subject && (
                    <span className="truncate text-xs text-text-tertiary">
                      {t.subject}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
