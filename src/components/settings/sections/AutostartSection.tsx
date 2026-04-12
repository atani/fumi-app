import { Section, ToggleRow } from "./shared";

interface AutostartSectionProps {
  autostartEnabled: boolean;
  onAutostartToggle: (enabled: boolean) => void;
}

export function AutostartSection({
  autostartEnabled,
  onAutostartToggle,
}: AutostartSectionProps) {
  return (
    <Section title="Autostart">
      <ToggleRow
        label="Launch on startup"
        description="Start Fumi when you log in to your computer"
        enabled={autostartEnabled}
        onToggle={onAutostartToggle}
        testId="autostart-toggle"
      />
    </Section>
  );
}
