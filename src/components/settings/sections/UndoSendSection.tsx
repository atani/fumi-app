import { Section } from "./shared";

interface UndoSendSectionProps {
  undoSendDelay: number;
  onUndoSendDelayChange: (value: number) => void;
}

export function UndoSendSection({
  undoSendDelay,
  onUndoSendDelayChange,
}: UndoSendSectionProps) {
  return (
    <Section title="Undo Send">
      <label className="mb-2 block text-sm text-text-secondary">
        Undo send delay
      </label>
      <select
        value={undoSendDelay}
        onChange={(e) => onUndoSendDelayChange(Number(e.target.value))}
        className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="undo-send-delay-select"
      >
        <option value={0}>Off</option>
        <option value={3}>3 seconds</option>
        <option value={5}>5 seconds</option>
        <option value={10}>10 seconds</option>
      </select>
      <p className="mt-1.5 text-xs text-text-tertiary">
        Delay sending emails so you can undo within the chosen time window.
      </p>
    </Section>
  );
}
