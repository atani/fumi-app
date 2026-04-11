import { describe, it, expect, beforeEach } from "vitest";
import { useThreadStore } from "./threadStore";

describe("threadStore", () => {
  beforeEach(() => {
    useThreadStore.setState({
      threads: [],
      selectedThreadId: null,
      selectedThreadIds: new Set<string>(),
      lastSelectedThreadId: null,
      messages: [],
      activeLabel: "INBOX",
      activeCategory: null,
      categoryMap: {},
      categoryCounts: {},
      isLoading: false,
      isSyncing: false,
    });
  });

  it("should have default state", () => {
    const state = useThreadStore.getState();
    expect(state.threads).toEqual([]);
    expect(state.selectedThreadId).toBeNull();
    expect(state.activeLabel).toBe("INBOX");
  });

  it("should set active label", () => {
    useThreadStore.getState().setActiveLabel("STARRED");
    expect(useThreadStore.getState().activeLabel).toBe("STARRED");
  });

  it("should set threads", () => {
    const threads = [
      {
        id: "t1",
        account_id: "a1",
        snippet: "Hello",
        subject: "Test",
        last_message_at: "2026-01-01T00:00:00Z",
        message_count: 1,
        is_read: false,
        is_starred: false,
        is_muted: false,
        snoozed_until: null,
      },
    ];
    useThreadStore.getState().setThreads(threads);
    expect(useThreadStore.getState().threads).toEqual(threads);
  });

  it("should set syncing state", () => {
    useThreadStore.getState().setSyncing(true);
    expect(useThreadStore.getState().isSyncing).toBe(true);
  });

  describe("multi-select", () => {
    const makeThread = (id: string) => ({
      id,
      account_id: "a1",
      snippet: "",
      subject: `Thread ${id}`,
      last_message_at: "2026-01-01T00:00:00Z",
      message_count: 1,
      is_read: false,
      is_starred: false,
      is_muted: false,
      snoozed_until: null,
    });

    beforeEach(() => {
      useThreadStore.getState().setThreads([
        makeThread("t1"),
        makeThread("t2"),
        makeThread("t3"),
        makeThread("t4"),
      ]);
    });

    it("should toggle select a thread", () => {
      useThreadStore.getState().toggleSelectThread("t1");
      expect(useThreadStore.getState().selectedThreadIds.has("t1")).toBe(true);
      expect(useThreadStore.getState().lastSelectedThreadId).toBe("t1");

      useThreadStore.getState().toggleSelectThread("t1");
      expect(useThreadStore.getState().selectedThreadIds.has("t1")).toBe(false);
    });

    it("should select range of threads", () => {
      useThreadStore.getState().toggleSelectThread("t1");
      useThreadStore.getState().selectRange("t1", "t3");
      const ids = useThreadStore.getState().selectedThreadIds;
      expect(ids.has("t1")).toBe(true);
      expect(ids.has("t2")).toBe(true);
      expect(ids.has("t3")).toBe(true);
      expect(ids.has("t4")).toBe(false);
    });

    it("should select all threads", () => {
      useThreadStore.getState().selectAllThreads();
      expect(useThreadStore.getState().selectedThreadIds.size).toBe(4);
    });

    it("should clear selection", () => {
      useThreadStore.getState().selectAllThreads();
      useThreadStore.getState().clearSelection();
      expect(useThreadStore.getState().selectedThreadIds.size).toBe(0);
      expect(useThreadStore.getState().lastSelectedThreadId).toBeNull();
    });

    it("should report multi-select mode", () => {
      expect(useThreadStore.getState().isMultiSelectMode()).toBe(false);
      useThreadStore.getState().toggleSelectThread("t1");
      expect(useThreadStore.getState().isMultiSelectMode()).toBe(true);
    });

    it("should remove multiple threads", () => {
      useThreadStore.getState().toggleSelectThread("t2");
      useThreadStore.getState().toggleSelectThread("t3");
      useThreadStore.getState().removeThreads(["t2", "t3"]);
      const state = useThreadStore.getState();
      expect(state.threads.map((t) => t.id)).toEqual(["t1", "t4"]);
      expect(state.selectedThreadIds.has("t2")).toBe(false);
      expect(state.selectedThreadIds.has("t3")).toBe(false);
    });

    it("should update multiple threads", () => {
      useThreadStore.getState().updateThreads(["t1", "t3"], { is_read: true });
      const state = useThreadStore.getState();
      expect(state.threads.find((t) => t.id === "t1")?.is_read).toBe(true);
      expect(state.threads.find((t) => t.id === "t2")?.is_read).toBe(false);
      expect(state.threads.find((t) => t.id === "t3")?.is_read).toBe(true);
    });
  });
});
