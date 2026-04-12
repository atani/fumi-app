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
  return (
    <Section title="Email Behavior">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Mark as read
          </label>
          <select
            value={markAsReadBehavior}
            onChange={(e) => onMarkAsReadChange(e.target.value)}
            className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="mark-as-read-select"
          >
            <option value="immediately">Immediately</option>
            <option value="after_2s">After 2 seconds</option>
            <option value="manually">Manually</option>
          </select>
          <p className="mt-1.5 text-xs text-text-tertiary">
            When to mark emails as read after opening them.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Default reply
          </label>
          <select
            value={defaultReplyMode}
            onChange={(e) => onDefaultReplyChange(e.target.value)}
            className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            data-testid="default-reply-select"
          >
            <option value="reply">Reply</option>
            <option value="reply_all">Reply All</option>
          </select>
          <p className="mt-1.5 text-xs text-text-tertiary">
            The default reply action when pressing the reply button or keyboard
            shortcut.
          </p>
        </div>

        <ToggleRow
          label="Send & Archive"
          description="Automatically archive threads after sending a reply"
          enabled={sendAndArchive}
          onToggle={onSendAndArchiveToggle}
          testId="send-and-archive-toggle"
        />
      </div>
    </Section>
  );
}
