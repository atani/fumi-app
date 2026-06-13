import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useShortcutStore,
  SHORTCUT_SECTIONS,
  SHORTCUT_LABELS,
} from "../../stores/shortcutStore";

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const { t } = useTranslation();
  const keyMap = useShortcutStore((s) => s.keyMap);

  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }

    // Use capture to intercept before the main shortcut handler
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="shortcuts-help-overlay"
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-bg-primary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="shortcuts-help-modal"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {t("search.shortcutsTitle")}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            {t("search.shortcutsClose")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-sm font-medium text-text-secondary">
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.actions.map((actionId) => {
                  const label = SHORTCUT_LABELS[actionId];
                  const combo = keyMap[actionId];
                  if (!label || !combo) return null;
                  return (
                    <li
                      key={actionId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-text-primary">{label}</span>
                      <kbd className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                        {combo}
                      </kbd>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
