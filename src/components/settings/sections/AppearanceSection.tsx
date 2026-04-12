import { Sun, Moon, Monitor, PanelRight, Rows2, EyeOff } from "lucide-react";
import type { ReadingPanePosition } from "../../../stores/uiStore";
import { useUIStore } from "../../../stores/uiStore";
import { COLOR_THEMES } from "../../../constants/themes";
import { Section } from "./shared";

type Theme = "system" | "light" | "dark";
type EmailDensity = "compact" | "default" | "comfortable";
type FontScale = "small" | "default" | "large" | "xlarge";

export function AppearanceSection() {
  const {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    emailDensity,
    setEmailDensity,
    fontScale,
    setFontScale,
    readingPanePosition,
    setReadingPanePosition,
  } = useUIStore();

  return (
    <Section title="Appearance">
      <label className="mb-2 block text-sm text-text-secondary">Theme</label>
      <div
        className="inline-flex rounded-lg border border-border-primary bg-bg-secondary p-1"
        data-testid="theme-selector"
      >
        {(
          [
            { value: "system", icon: Monitor, label: "System" },
            { value: "light", icon: Sun, label: "Light" },
            { value: "dark", icon: Moon, label: "Dark" },
          ] as const
        ).map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value as Theme)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              theme === value
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid={`theme-${value}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <label className="mt-4 mb-2 block text-sm text-text-secondary">
        Accent color
      </label>
      <div className="flex gap-2" data-testid="color-theme-selector">
        {COLOR_THEMES.map((ct) => (
          <button
            key={ct.id}
            onClick={() => setColorTheme(ct.id)}
            title={ct.name}
            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
              colorTheme === ct.id
                ? "border-text-primary scale-110"
                : "border-transparent"
            }`}
            style={{ backgroundColor: ct.swatch }}
            data-testid={`color-theme-${ct.id}`}
          />
        ))}
      </div>

      <label className="mt-4 mb-2 block text-sm text-text-secondary">
        Font size
      </label>
      <div
        className="inline-flex rounded-lg border border-border-primary bg-bg-secondary p-1"
        data-testid="font-scale-selector"
      >
        {(
          [
            { value: "small", label: "Small" },
            { value: "default", label: "Default" },
            { value: "large", label: "Large" },
            { value: "xlarge", label: "X-Large" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFontScale(value as FontScale)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              fontScale === value
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid={`font-scale-${value}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-4 mb-2 block text-sm text-text-secondary">
        Email list density
      </label>
      <div
        className="inline-flex rounded-lg border border-border-primary bg-bg-secondary p-1"
        data-testid="density-selector"
      >
        {(
          [
            { value: "compact", label: "Compact" },
            { value: "default", label: "Default" },
            { value: "comfortable", label: "Comfortable" },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setEmailDensity(value as EmailDensity)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              emailDensity === value
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid={`density-${value}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-4 mb-2 block text-sm text-text-secondary">
        Reading pane
      </label>
      <div
        className="inline-flex rounded-lg border border-border-primary bg-bg-secondary p-1"
        data-testid="reading-pane-selector"
      >
        {(
          [
            { value: "right", icon: PanelRight, label: "Right" },
            { value: "bottom", icon: Rows2, label: "Bottom" },
            { value: "hidden", icon: EyeOff, label: "Hidden" },
          ] as const
        ).map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setReadingPanePosition(value as ReadingPanePosition)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              readingPanePosition === value
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid={`reading-pane-${value}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-text-tertiary">
        Controls where the email preview appears. When hidden, double-click or
        press Enter to open a thread.
      </p>
    </Section>
  );
}
