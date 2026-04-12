import { Section } from "./shared";

const SYNC_INTERVALS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
];

interface SyncSectionProps {
  syncInterval: number;
  onSyncIntervalChange: (value: number) => void;
}

export function SyncSection({
  syncInterval,
  onSyncIntervalChange,
}: SyncSectionProps) {
  return (
    <Section title="Sync">
      <label className="mb-2 block text-sm text-text-secondary">
        Sync interval
      </label>
      <select
        value={syncInterval}
        onChange={(e) => onSyncIntervalChange(Number(e.target.value))}
        className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="sync-interval-select"
      >
        {SYNC_INTERVALS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </Section>
  );
}
