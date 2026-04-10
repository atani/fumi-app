import { describe, it, expect, beforeEach } from "vitest";
import { useThreadStore } from "./threadStore";

describe("threadStore", () => {
  beforeEach(() => {
    useThreadStore.setState({
      threads: [],
      selectedThreadId: null,
      messages: [],
      activeLabel: "INBOX",
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
      },
    ];
    useThreadStore.getState().setThreads(threads);
    expect(useThreadStore.getState().threads).toEqual(threads);
  });

  it("should set syncing state", () => {
    useThreadStore.getState().setSyncing(true);
    expect(useThreadStore.getState().isSyncing).toBe(true);
  });
});
