import { create } from "zustand";
import { getDb } from "../services/db/connection";
import { COLOR_THEMES, DEFAULT_COLOR_THEME } from "../constants/themes";

type Theme = "light" | "dark" | "system";
type EmailDensity = "compact" | "default" | "comfortable";
type FontScale = "small" | "default" | "large" | "xlarge";
export type ReadingPanePosition = "right" | "bottom" | "hidden";

const FONT_SCALE_VALUES: FontScale[] = ["small", "default", "large", "xlarge"];
const VALID_READING_PANE_POSITIONS: ReadingPanePosition[] = ["right", "bottom", "hidden"];

interface UIState {
  theme: Theme;
  colorTheme: string;
  emailDensity: EmailDensity;
  fontScale: FontScale;
  sidebarCollapsed: boolean;
  isOnline: boolean;
  readingPanePosition: ReadingPanePosition;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: string) => void;
  setEmailDensity: (density: EmailDensity) => void;
  setFontScale: (scale: FontScale) => void;
  toggleSidebar: () => void;
  setOnline: (online: boolean) => void;
  setReadingPanePosition: (position: ReadingPanePosition) => void;
  initTheme: () => Promise<void>;
  initReadingPanePosition: () => Promise<void>;
}

function applyFontScaleClass(scale: FontScale): void {
  const el = document.documentElement;
  for (const s of FONT_SCALE_VALUES) {
    el.classList.remove(`font-scale-${s}`);
  }
  el.classList.add(`font-scale-${scale}`);
}

function applyThemeClass(theme: Theme): void {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function applyColorTheme(colorThemeId: string): void {
  const theme = COLOR_THEMES.find((t) => t.id === colorThemeId);
  if (!theme) return;

  const isDark = document.documentElement.classList.contains("dark");
  const variant = isDark ? theme.dark : theme.light;
  const root = document.documentElement;
  root.style.setProperty("--theme-accent", variant.accent);
  root.style.setProperty("--theme-accent-hover", variant.accentHover);
  root.style.setProperty("--theme-accent-light", variant.accentLight);
}

async function saveSetting(key: string, value: string): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
      [key, value],
    );
  } catch {
    // Silently fail — DB may not be available in tests or browser-only mode
  }
}

async function saveThemeSetting(theme: Theme): Promise<void> {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ('theme', $1) ON CONFLICT(key) DO UPDATE SET value = $1",
      [theme],
    );
  } catch {
    // Silently fail — DB may not be available in tests or browser-only mode
  }
}

let systemThemeCleanup: (() => void) | null = null;

function listenSystemTheme(theme: Theme): void {
  if (systemThemeCleanup) {
    systemThemeCleanup();
    systemThemeCleanup = null;
  }

  if (theme === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyThemeClass("system");
      const { colorTheme } = useUIStore.getState();
      applyColorTheme(colorTheme);
    };
    mq.addEventListener("change", handler);
    systemThemeCleanup = () => mq.removeEventListener("change", handler);
  }
}

const VALID_DENSITIES: EmailDensity[] = ["compact", "default", "comfortable"];

export const useUIStore = create<UIState>((set) => ({
  theme: "system",
  colorTheme: DEFAULT_COLOR_THEME,
  emailDensity: "default" as EmailDensity,
  fontScale: "default" as FontScale,
  sidebarCollapsed: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  readingPanePosition: "right" as ReadingPanePosition,

  setColorTheme: (colorTheme: string) => {
    set({ colorTheme });
    applyColorTheme(colorTheme);
    void saveSetting("color_theme", colorTheme);
  },

  setEmailDensity: (density: EmailDensity) => {
    set({ emailDensity: density });
    void saveSetting("email_density", density);
  },

  setFontScale: (scale: FontScale) => {
    set({ fontScale: scale });
    applyFontScaleClass(scale);
    void saveSetting("font_scale", scale);
  },

  setTheme: (theme) => {
    set({ theme });
    applyThemeClass(theme);
    listenSystemTheme(theme);
    void saveThemeSetting(theme);
    const { colorTheme } = useUIStore.getState();
    applyColorTheme(colorTheme);
  },

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setOnline: (online: boolean) => set({ isOnline: online }),

  setReadingPanePosition: (position: ReadingPanePosition) => {
    set({ readingPanePosition: position });
    void saveSetting("reading_pane_position", position);
  },

  initReadingPanePosition: async () => {
    try {
      const db = await getDb();
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'reading_pane_position'",
      );
      const row = rows[0];
      if (row && VALID_READING_PANE_POSITIONS.includes(row.value as ReadingPanePosition)) {
        set({ readingPanePosition: row.value as ReadingPanePosition });
      }
    } catch {
      // DB not available — use default
    }
  },

  initTheme: async () => {
    try {
      const db = await getDb();
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'theme'",
      );
      const first = rows[0];
      if (rows.length > 0 && first) {
        const saved = first.value as Theme;
        if (saved === "light" || saved === "dark" || saved === "system") {
          set({ theme: saved });
          applyThemeClass(saved);
          listenSystemTheme(saved);
        }
      } else {
        applyThemeClass("system");
        listenSystemTheme("system");
      }
    } catch {
      // DB not available — use default
      applyThemeClass("system");
      listenSystemTheme("system");
    }

    // Load font scale
    try {
      const db = await getDb();
      const scaleRows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'font_scale'",
      );
      const scaleRow = scaleRows[0];
      if (scaleRow && FONT_SCALE_VALUES.includes(scaleRow.value as FontScale)) {
        const savedScale = scaleRow.value as FontScale;
        set({ fontScale: savedScale });
        applyFontScaleClass(savedScale);
      } else {
        applyFontScaleClass("default");
      }
    } catch {
      applyFontScaleClass("default");
    }

    // Load email density
    try {
      const db = await getDb();
      const densityRows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'email_density'",
      );
      const densityRow = densityRows[0];
      if (densityRow && VALID_DENSITIES.includes(densityRow.value as EmailDensity)) {
        set({ emailDensity: densityRow.value as EmailDensity });
      }
    } catch {
      // DB not available — use default
    }

    // Load color theme
    try {
      const db = await getDb();
      const colorRows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'color_theme'",
      );
      const colorRow = colorRows[0];
      if (colorRow && COLOR_THEMES.some((t) => t.id === colorRow.value)) {
        set({ colorTheme: colorRow.value });
        applyColorTheme(colorRow.value);
      } else {
        applyColorTheme(DEFAULT_COLOR_THEME);
      }
    } catch {
      applyColorTheme(DEFAULT_COLOR_THEME);
    }
  },
}));
