import { describe, it, expect, beforeEach, vi } from "vitest";
import { useShortcutStore, DEFAULT_KEY_MAP } from "./shortcutStore";

// Mock getDb so tests don't depend on SQLite
vi.mock("../services/db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    select: vi.fn().mockResolvedValue([]),
  }),
}));

describe("shortcutStore", () => {
  beforeEach(() => {
    // Reset to defaults between tests.
    useShortcutStore.setState({
      keyMap: { ...DEFAULT_KEY_MAP },
      reverseMap: new Map(
        Object.entries(DEFAULT_KEY_MAP).map(([id, combo]) => [combo, id]),
      ),
    });
    vi.clearAllMocks();
  });

  it("should expose the default keyMap", () => {
    const { keyMap } = useShortcutStore.getState();
    expect(keyMap.navigate_next).toBe("j");
    expect(keyMap.navigate_prev).toBe("k");
    expect(keyMap.compose).toBe("c");
    expect(keyMap.search_ctrl).toBe("Ctrl+k");
    expect(keyMap.go_inbox).toBe("g i");
  });

  it("should build a reverseMap that matches defaults", () => {
    const { reverseMap } = useShortcutStore.getState();
    expect(reverseMap.get("j")).toBe("navigate_next");
    expect(reverseMap.get("?")).toBe("shortcuts_help");
    expect(reverseMap.get("g i")).toBe("go_inbox");
  });

  it("loadKeyMap merges persisted overrides onto defaults", async () => {
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: vi
        .fn()
        .mockResolvedValue([
          { value: JSON.stringify({ archive: "x", compose: "n" }) },
        ]),
    } as never);

    await useShortcutStore.getState().loadKeyMap();
    const state = useShortcutStore.getState();

    // Overrides applied
    expect(state.keyMap.archive).toBe("x");
    expect(state.keyMap.compose).toBe("n");
    // Untouched defaults still present
    expect(state.keyMap.navigate_next).toBe("j");
    expect(state.keyMap.go_inbox).toBe("g i");
    // Reverse map reflects overrides
    expect(state.reverseMap.get("x")).toBe("archive");
    expect(state.reverseMap.get("n")).toBe("compose");
  });

  it("loadKeyMap leaves defaults intact when no persisted settings exist", async () => {
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await useShortcutStore.getState().loadKeyMap();
    expect(useShortcutStore.getState().keyMap).toEqual(DEFAULT_KEY_MAP);
  });

  it("updateKey changes binding and persists it", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await useShortcutStore.getState().updateKey("archive", "X");

    const state = useShortcutStore.getState();
    expect(state.keyMap.archive).toBe("X");
    expect(state.reverseMap.get("X")).toBe("archive");
    expect(executeMock).toHaveBeenCalledTimes(1);

    // Persisted JSON should include the override
    const persistedArgs = executeMock.mock.calls[0]![1] as unknown[];
    const serialized = JSON.parse(persistedArgs[1] as string) as Record<
      string,
      string
    >;
    expect(serialized.archive).toBe("X");
  });

  it("resetToDefaults restores every default and persists", async () => {
    // Start from a mutated state.
    useShortcutStore.setState({
      keyMap: { ...DEFAULT_KEY_MAP, archive: "X", compose: "N" },
      reverseMap: new Map([
        ...Object.entries(DEFAULT_KEY_MAP).map(
          ([id, combo]) => [combo, id] as [string, string],
        ),
        ["X", "archive"],
        ["N", "compose"],
      ]),
    });

    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await useShortcutStore.getState().resetToDefaults();

    expect(useShortcutStore.getState().keyMap).toEqual(DEFAULT_KEY_MAP);
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("resetKey restores only a single action to its default", async () => {
    useShortcutStore.setState({
      keyMap: { ...DEFAULT_KEY_MAP, archive: "X", compose: "N" },
      reverseMap: new Map(),
    });

    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await useShortcutStore.getState().resetKey("archive");

    const state = useShortcutStore.getState();
    expect(state.keyMap.archive).toBe(DEFAULT_KEY_MAP.archive);
    // Other modified keys are untouched
    expect(state.keyMap.compose).toBe("N");
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("resetKey is a no-op for an unknown action id", async () => {
    const before = useShortcutStore.getState().keyMap;
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../services/db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await useShortcutStore.getState().resetKey("not_a_real_action");

    expect(useShortcutStore.getState().keyMap).toEqual(before);
    expect(executeMock).not.toHaveBeenCalled();
  });
});
