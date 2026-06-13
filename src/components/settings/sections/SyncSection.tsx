import { useTranslation } from "react-i18next";
import { Section } from "./shared";

const SYNC_INTERVALS = [
  { value: 30, labelKey: "settingsUi.sync.interval30s" },
  { value: 60, labelKey: "settingsUi.sync.interval1m" },
  { value: 120, labelKey: "settingsUi.sync.interval2m" },
  { value: 300, labelKey: "settingsUi.sync.interval5m" },
];

interface SyncSectionProps {
  syncInterval: number;
  onSyncIntervalChange: (value: number) => void;
}

export function SyncSection({
  syncInterval,
  onSyncIntervalChange,
}: SyncSectionProps) {
  const { t } = useTranslation();
  return (
    <Section title={t("settingsUi.sync.title")}>
      <label className="mb-2 block text-sm text-text-secondary">
        {t("settingsUi.sync.interval")}
      </label>
      <select
        value={syncInterval}
        onChange={(e) => onSyncIntervalChange(Number(e.target.value))}
        className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        data-testid="sync-interval-select"
      >
        {SYNC_INTERVALS.map(({ value, labelKey }) => (
          <option key={value} value={value}>
            {t(labelKey)}
          </option>
        ))}
      </select>
    </Section>
  );
}
