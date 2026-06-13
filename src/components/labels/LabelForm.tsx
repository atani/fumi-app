import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

const PRESET_COLORS = [
  "#4f46e5", // Indigo
  "#e11d48", // Rose
  "#059669", // Emerald
  "#d97706", // Amber
  "#0284c7", // Sky
  "#7c3aed", // Violet
  "#ea580c", // Orange
  "#475569", // Slate
] as const;

interface LabelFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: string | null) => void;
  initialName?: string;
  initialColor?: string | null;
  title: string;
}

export function LabelForm({
  isOpen,
  onClose,
  onSave,
  initialName = "",
  initialColor = null,
  title,
}: LabelFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string | null>(initialColor);

  useEffect(() => {
    setName(initialName);
    setColor(initialColor ?? null);
  }, [initialName, initialColor, isOpen]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
    onClose();
  }, [name, color, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleSave, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="label-form-backdrop"
    >
      <div
        className="w-80 rounded-xl border border-border-primary bg-bg-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="label-form"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("labels.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-text-secondary">
          {t("labels.name")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("labels.namePlaceholder")}
          className="mb-4 w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          autoFocus
          data-testid="label-name-input"
        />

        <label className="mb-2 block text-xs font-medium text-text-secondary">
          {t("labels.color")}
        </label>
        <div className="mb-5 flex flex-wrap gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              onClick={() => setColor(color === preset ? null : preset)}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                color === preset
                  ? "scale-110 border-text-primary"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: preset }}
              title={preset}
              data-testid={`label-color-${preset}`}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            {t("labels.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
            data-testid="label-form-save"
          >
            {t("labels.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
