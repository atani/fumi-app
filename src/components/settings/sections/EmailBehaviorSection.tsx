import { useTranslation } from "react-i18next";
import { Section, ToggleRow } from "./shared";

interface EmailBehaviorSectionProps {
  markAsReadBehavior: string;
  onMarkAsReadChange: (value: string) => void;
  defaultReplyMode: string;
  onDefaultReplyChange: (value: string) => void;
  sendAndArchive: boolean;
  onSendAndArchiveToggle: (enabled: boolean) => void;
}

export function EmailBehaviorSection({
  markAsReadBehavior,
  onMarkAsReadChange,
  defaultReplyMode,
  onDefaultReplyChange,
  sendAndArchive,
  onSendAndArchiveToggle,
}: EmailBehaviorSectionProps) {
  const { t } = useTranslation();
  return (
    <Section title={t("settingsUi.emailBehavior.title")}>
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            {t("settingsUi.emailBehavior.markAsRead")}
          </label>
          <select
            value={markAsReadBehavior}
            onChange={(e) => onMarkAsReadChange(e.target.value)}
            className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="mark-as-read-select"
          >
            <option value="immediately">
              {t("settingsUi.emailBehavior.markImmediately")}
            </option>
            <option value="after_2s">
              {t("settingsUi.emailBehavior.markAfter2s")}
            </option>
            <option value="manually">
              {t("settingsUi.emailBehavior.markManually")}
            </option>
          </select>
          <p className="mt-1.5 text-xs text-text-tertiary">
            {t("settingsUi.emailBehavior.markHint")}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            {t("settingsUi.emailBehavior.defaultReply")}
          </label>
          <select
            value={defaultReplyMode}
            onChange={(e) => onDefaultReplyChange(e.target.value)}
            className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="default-reply-select"
          >
            <option value="reply">
              {t("settingsUi.emailBehavior.reply")}
            </option>
            <option value="reply_all">
              {t("settingsUi.emailBehavior.replyAll")}
            </option>
          </select>
          <p className="mt-1.5 text-xs text-text-tertiary">
            {t("settingsUi.emailBehavior.defaultReplyHint")}
          </p>
        </div>

        <ToggleRow
          label={t("settingsUi.emailBehavior.sendAndArchive")}
          description={t("settingsUi.emailBehavior.sendAndArchiveDesc")}
          enabled={sendAndArchive}
          onToggle={onSendAndArchiveToggle}
          testId="send-and-archive-toggle"
        />
      </div>
    </Section>
  );
}
