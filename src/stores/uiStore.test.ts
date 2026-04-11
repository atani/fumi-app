import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUIStore } from "./uiStore";

// Mock getDb so tests don't depend on SQLite
vi.mock("../services/db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    select: vi.fn().mockResolvedValue([]),
  }),
}));

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: "system",
      sidebarCollapsed: false,
    });
    document.documentElement.classList.remove("dark");

    // jsdom does not implement matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  it("should have default state", () => {
    const state = useUIStore.getState();
    expect(state.theme).toBe("system");
    expect(state.sidebarCollapsed).toBe(false);
  });

  it("should toggle sidebar", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it("should set theme to dark and apply class", () => {
    useUIStore.getState().setTheme("dark");
    expect(useUIStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should set theme to light and remove dark class", () => {
    document.documentElement.classList.add("dark");
    useUIStore.getState().setTheme("light");
    expect(useUIStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should initialize theme from DB", async () => {
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: vi.fn().mockResolvedValue([{ value: "dark" }]),
    } as never);

    await useUIStore.getState().initTheme();
    expect(useUIStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should fall back to system when DB returns no rows", async () => {
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await useUIStore.getState().initTheme();
    expect(useUIStore.getState().theme).toBe("system");
  });
});
