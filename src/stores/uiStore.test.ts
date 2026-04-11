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
      emailDensity: "default",
      sidebarCollapsed: false,
      readingPanePosition: "right",
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

  it("should set email density", () => {
    useUIStore.getState().setEmailDensity("compact");
    expect(useUIStore.getState().emailDensity).toBe("compact");
    useUIStore.getState().setEmailDensity("comfortable");
    expect(useUIStore.getState().emailDensity).toBe("comfortable");
  });

  it("should load email density from DB", async () => {
    const { getDb } = await import("../services/db/connection");
    const selectMock = vi.fn()
      .mockResolvedValueOnce([{ value: "dark" }])       // theme
      .mockResolvedValueOnce([])                          // font_scale
      .mockResolvedValueOnce([{ value: "compact" }]);     // email_density
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    await useUIStore.getState().initTheme();
    expect(useUIStore.getState().emailDensity).toBe("compact");
  });

  it("should have default reading pane position", () => {
    expect(useUIStore.getState().readingPanePosition).toBe("right");
  });

  it("should set reading pane position", () => {
    useUIStore.getState().setReadingPanePosition("bottom");
    expect(useUIStore.getState().readingPanePosition).toBe("bottom");
    useUIStore.getState().setReadingPanePosition("hidden");
    expect(useUIStore.getState().readingPanePosition).toBe("hidden");
    useUIStore.getState().setReadingPanePosition("right");
    expect(useUIStore.getState().readingPanePosition).toBe("right");
  });

  it("should load reading pane position from DB", async () => {
    const { getDb } = await import("../services/db/connection");
    const selectMock = vi.fn().mockResolvedValue([{ value: "bottom" }]);
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    await useUIStore.getState().initReadingPanePosition();
    expect(useUIStore.getState().readingPanePosition).toBe("bottom");
  });

  it("should keep default reading pane position for invalid DB value", async () => {
    const { getDb } = await import("../services/db/connection");
    const selectMock = vi.fn().mockResolvedValue([{ value: "invalid" }]);
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    await useUIStore.getState().initReadingPanePosition();
    expect(useUIStore.getState().readingPanePosition).toBe("right");
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
