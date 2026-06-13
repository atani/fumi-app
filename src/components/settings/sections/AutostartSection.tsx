import { useTranslation } from "react-i18next";
import { Section, ToggleRow } from "./shared";

interface AutostartSectionProps {
  autostartEnabled: boolean;
  onAutostartToggle: (enabled: boolean) => void;
}

export function AutostartSection({
  autostartEnabled,
  onAutostartToggle,
}: AutostartSectionProps) {
  const { t } = useTranslation();
  return (
    <Section title={t("settingsUi.autostart.title")}>
      <ToggleRow
        label={t("settingsUi.autostart.launchOnStartup")}
        description={t("settingsUi.autostart.launchOnStartupDesc")}
        enabled={autostartEnabled}
        onToggle={onAutostartToggle}
        testId="autostart-toggle"
      />
    </Section>
  );
}
