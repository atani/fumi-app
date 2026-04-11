import { create } from "zustand";
import { getDb } from "../services/db/connection";

type Theme = "light" | "dark" | "system";

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  isOnline: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setOnline: (online: boolean) => void;
  initTheme: () => Promise<void>;
}

function applyThemeClass(theme: Theme): void {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
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
    const handler = () => applyThemeClass("system");
    mq.addEventListener("change", handler);
    systemThemeCleanup = () => mq.removeEventListener("change", handler);
  }
}

export const useUIStore = create<UIState>((set) => ({
  theme: "system",
  sidebarCollapsed: false,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

  setTheme: (theme) => {
    set({ theme });
    applyThemeClass(theme);
    listenSystemTheme(theme);
    void saveThemeSetting(theme);
  },

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setOnline: (online: boolean) => set({ isOnline: online }),

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
          return;
        }
      }
    } catch {
      // DB not available — use default
    }
    // Apply default system theme
    applyThemeClass("system");
    listenSystemTheme("system");
  },
}));
