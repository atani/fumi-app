import { useTranslation } from "react-i18next";
import { Section } from "./shared";

interface UndoSendSectionProps {
  undoSendDelay: number;
  onUndoSendDelayChange: (value: number) => void;
}

export function UndoSendSection({
  undoSendDelay,
  onUndoSendDelayChange,
}: UndoSendSectionProps) {
  const { t } = useTranslation();
  return (
    <Section title={t("settingsUi.undoSend.title")}>
      <label className="mb-2 block text-sm text-text-secondary">
        {t("settingsUi.undoSend.delay")}
      </label>
      <select
        value={undoSendDelay}
        onChange={(e) => onUndoSendDelayChange(Number(e.target.value))}
        className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="undo-send-delay-select"
      >
        <option value={0}>{t("settingsUi.undoSend.off")}</option>
        <option value={3}>{t("settingsUi.undoSend.delay3s")}</option>
        <option value={5}>{t("settingsUi.undoSend.delay5s")}</option>
        <option value={10}>{t("settingsUi.undoSend.delay10s")}</option>
      </select>
      <p className="mt-1.5 text-xs text-text-tertiary">
        {t("settingsUi.undoSend.hint")}
      </p>
    </Section>
  );
}
