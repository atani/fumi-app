import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, X } from "lucide-react";

interface FollowUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSetFollowUp: (hours: number) => void;
}

interface FollowUpPreset {
  labelKey: string;
  hours: number;
}

const PRESETS: FollowUpPreset[] = [
  { labelKey: "email.followUp.preset1Day", hours: 24 },
  { labelKey: "email.followUp.preset2Days", hours: 48 },
  { labelKey: "email.followUp.preset3Days", hours: 72 },
  { labelKey: "email.followUp.preset1Week", hours: 168 },
];

export function FollowUpDialog({
  isOpen,
  onClose,
  onSetFollowUp,
}: FollowUpDialogProps) {
  const { t } = useTranslation();
  const [showCustom, setShowCustom] = useState(false);
  const [customHours, setCustomHours] = useState("48");

  if (!isOpen) return null;

  const handlePreset = (preset: FollowUpPreset) => {
    onSetFollowUp(preset.hours);
    onClose();
  };

  const handleCustomSubmit = () => {
    const parsed = parseInt(customHours, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      onSetFollowUp(parsed);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-primary bg-bg-primary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("email.followUp.title")}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!showCustom ? (
          <div className="py-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.hours}
                onClick={() => handlePreset(preset)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-hover"
              >
                <BellRing className="h-4 w-4 text-text-secondary" />
                <span className="flex-1 text-left">{t(preset.labelKey)}</span>
                <span className="text-xs text-text-tertiary">
                  {t("email.followUp.hours", { count: preset.hours })}
                </span>
              </button>
            ))}
            <div className="border-t border-border-secondary" />
            <button
              onClick={() => setShowCustom(true)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-hover"
            >
              <BellRing className="h-4 w-4 text-text-secondary" />
              <span className="flex-1 text-left">{t("email.followUp.custom")}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">
                {t("email.followUp.hoursLabel")}
              </label>
              <input
                type="number"
                min="1"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                data-testid="follow-up-custom-hours"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 rounded-lg border border-border-primary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
              >
                {t("email.followUp.back")}
              </button>
              <button
                onClick={handleCustomSubmit}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover"
              >
                {t("email.followUp.setReminder")}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
