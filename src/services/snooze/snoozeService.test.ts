import { describe, it, expect, beforeEach, vi } from "vitest";
import { useThreadStore } from "../../stores/threadStore";
import { useUIStore } from "../../stores/uiStore";

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0 });
const mockSelect = vi.fn().mockResolvedValue([]);

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}));

const mockAuthenticatedFetch = vi.fn().mockResolvedValue({});

vi.mock("../gmail/api", () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
}));

const mockEnqueueOperation = vi.fn().mockResolvedValue(undefined);

vi.mock("../queue/queueProcessor", () => ({
  enqueueOperation: (...args: unknown[]) => mockEnqueueOperation(...args),
}));

const { snoozeThread, checkSnoozedThreads } = await import(
  "./snoozeService"
);

function makeAccount(overrides = {}) {
  return {
    id: "acc-1",
    email: "test@example.com",
    name: "Test User",
    picture: "",
    provider: "gmail_api" as const,
    access_token: "token",
    refresh_token: "refresh",
    token_expiry: null,
    ...overrides,
  };
}

describe("snoozeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThreadStore.setState({
      threads: [
        {
          id: "thread-1",
          account_id: "acc-1",
          snippet: "Test",
          subject: "Test",
          last_message_at: "2024-01-01T00:00:00Z",
          message_count: 1,
          is_read: false,
          is_starred: false,
          is_muted: false,
          snoozed_until: null,
        },
      ],
      selectedThreadId: null,
      isSyncing: false,
    });
  });

  beforeEach(() => {
    useUIStore.setState({ isOnline: true });
  });

  describe("snoozeThread", () => {
    it("removes thread from store optimistically", async () => {
      const account = makeAccount();

      await snoozeThread(account, "thread-1", "2025-01-01T09:00:00Z");

      const threads = useThreadStore.getState().threads;
      expect(threads.find((t) => t.id === "thread-1")).toBeUndefined();
    });

    it("enqueues the label change instead of calling the API when offline", async () => {
      useUIStore.setState({ isOnline: false });
      const account = makeAccount();

      await snoozeThread(account, "thread-1", "2025-01-01T09:00:00Z");

      // Offline snooze must be queued (not sent directly) so it isn't lost, and
      // the local snooze state is still written.
      expect(mockEnqueueOperation).toHaveBeenCalledWith("acc-1", "modifyLabels", {
        threadId: "thread-1",
        addLabelIds: [],
        removeLabelIds: ["INBOX"],
      });
      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE threads SET snoozed_until"),
        ["2025-01-01T09:00:00Z", "thread-1", "acc-1"],
      );
    });

    it("reverts the optimistic removal when the label change fails", async () => {
      mockAuthenticatedFetch.mockRejectedValueOnce(new Error("api down"));
      const account = makeAccount();

      await expect(
        snoozeThread(account, "thread-1", "2025-01-01T09:00:00Z"),
      ).rejects.toThrow("api down");

      // Regression: without revert the thread stays hidden while Gmail still has
      // it in INBOX, so it reappears on next sync ("snoozed but back in inbox").
      expect(
        useThreadStore.getState().threads.find((t) => t.id === "thread-1"),
      ).toBeDefined();
    });

    it("calls Gmail API to remove INBOX label", async () => {
      const account = makeAccount();

      await snoozeThread(account, "thread-1", "2025-01-01T09:00:00Z");

      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        account,
        "/threads/thread-1/modify",
        {
          method: "POST",
          body: JSON.stringify({
            addLabelIds: [],
            removeLabelIds: ["INBOX"],
          }),
        },
      );
    });

    it("sets snoozed_until in DB and updates labels", async () => {
      const account = makeAccount();

      await snoozeThread(account, "thread-1", "2025-01-01T09:00:00Z");

      // Should set snoozed_until
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE threads SET snoozed_until"),
        ["2025-01-01T09:00:00Z", "thread-1", "acc-1"],
      );

      // Should remove INBOX label from thread_labels
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining(
          "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2 AND label_id = 'INBOX'",
        ),
        ["thread-1", "acc-1"],
      );

      // Should add SNOOZED label
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR IGNORE INTO thread_labels"),
        ["thread-1", "acc-1"],
      );
    });
  });

  describe("checkSnoozedThreads", () => {
    it("unsnoozes past-due threads", async () => {
      const account = makeAccount();

      // Simulate two expired snoozed threads
      mockSelect.mockResolvedValueOnce([
        { id: "thread-1", account_id: "acc-1" },
        { id: "thread-2", account_id: "acc-1" },
      ]);

      await checkSnoozedThreads(account);

      // Should have called authenticatedFetch to add INBOX back for each thread
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        account,
        "/threads/thread-1/modify",
        {
          method: "POST",
          body: JSON.stringify({
            addLabelIds: ["INBOX"],
            removeLabelIds: [],
          }),
        },
      );
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        account,
        "/threads/thread-2/modify",
        {
          method: "POST",
          body: JSON.stringify({
            addLabelIds: ["INBOX"],
            removeLabelIds: [],
          }),
        },
      );

      // Should clear snoozed_until for each
      const clearCalls = mockExecute.mock.calls.filter(
        (c: unknown[]) =>
          typeof c[0] === "string" &&
          (c[0] as string).includes("snoozed_until = NULL"),
      );
      expect(clearCalls).toHaveLength(2);
    });

    it("does nothing when no threads are past due", async () => {
      const account = makeAccount();

      // No expired threads
      mockSelect.mockResolvedValueOnce([]);

      await checkSnoozedThreads(account);

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });
});
