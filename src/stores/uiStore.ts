import { create } from "zustand";

interface UIState {
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  setTheme: (theme: "light" | "dark" | "system") => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "system",
  sidebarCollapsed: false,

  setTheme: (theme) => {
    set({ theme });
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  },

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
