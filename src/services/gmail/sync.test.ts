import { describe, it, expect, beforeEach, vi } from "vitest";

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0 });
const mockSelect = vi.fn().mockResolvedValue([]);

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}));

const mockAuthenticatedFetch = vi.fn();

vi.mock("./api", () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
  getHeader: vi.fn(
    (
      msg: { payload: { headers: { name: string; value: string }[] } },
      name: string,
    ) =>
      msg.payload.headers.find(
        (h: { name: string }) =>
          h.name.toLowerCase() === name.toLowerCase(),
      )?.value,
  ),
  getMessageBody: vi.fn(() => "<p>body</p>"),
}));

const mockUpsertThread = vi.fn().mockResolvedValue(undefined);
const mockSetThreadLabelsBatch = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/threads", () => ({
  upsertThread: (...args: unknown[]) => mockUpsertThread(...args),
  setThreadLabelsBatch: (...args: unknown[]) =>
    mockSetThreadLabelsBatch(...args),
}));

const mockUpsertMessage = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/messages", () => ({
  upsertMessage: (...args: unknown[]) => mockUpsertMessage(...args),
}));

vi.mock("../contacts/contactService", () => ({
  recordContactsFromMessages: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../filters/filterEngine", () => ({
  processFilters: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../bundles/bundleManager", () => ({
  processBundleRules: vi.fn().mockResolvedValue(undefined),
}));

const mockHasPendingOps = vi.fn().mockResolvedValue(false);

vi.mock("../queue/queueProcessor", () => ({
  hasPendingOpsForThread: (...args: unknown[]) => mockHasPendingOps(...args),
}));

const { syncLabels, syncInbox } = await import("./sync");

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

describe("sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncLabels", () => {
    it("returns early when account has no tokens", async () => {
      const account = makeAccount({
        access_token: null,
        refresh_token: null,
      });

      await syncLabels(account);

      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });

    it("upserts each label from Gmail API", async () => {
      const account = makeAccount();
      mockAuthenticatedFetch.mockResolvedValueOnce({
        labels: [
          { id: "INBOX", name: "INBOX", type: "system" },
          { id: "SENT", name: "SENT", type: "system" },
          { id: "Label_1", name: "Work", type: "user" },
        ],
      });

      await syncLabels(account);

      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(account, "/labels");
      expect(mockExecute).toHaveBeenCalledTimes(3);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO labels"),
        ["INBOX", "acc-1", "INBOX", "system"],
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO labels"),
        ["Label_1", "acc-1", "Work", "user"],
      );
    });
  });

  describe("syncInbox", () => {
    it("returns empty when account has no tokens", async () => {
      const account = makeAccount({
        access_token: null,
        refresh_token: null,
      });

      const result = await syncInbox(account);

      expect(result).toEqual({ threads: [], newThreads: [] });
      expect(mockAuthenticatedFetch).not.toHaveBeenCalled();
    });

    it("returns empty when Gmail returns no threads", async () => {
      const account = makeAccount();
      mockAuthenticatedFetch.mockResolvedValueOnce({ threads: [] });

      const result = await syncInbox(account);

      expect(result).toEqual({ threads: [], newThreads: [] });
    });

    it("processes threads correctly and detects new threads", async () => {
      const account = makeAccount();

      // First call: thread list
      mockAuthenticatedFetch.mockImplementation(
        (_acct: unknown, url: string) => {
          if (url.startsWith("/threads?")) {
            return Promise.resolve({
              threads: [{ id: "t-1", snippet: "Hello" }],
            });
          }
          if (url === "/threads/t-1?format=full") {
            return Promise.resolve({
              id: "t-1",
              snippet: "Hello there",
              messages: [
                {
                  id: "m-1",
                  threadId: "t-1",
                  internalDate: String(Date.now()),
                  snippet: "Hello",
                  labelIds: ["INBOX", "UNREAD"],
                  payload: {
                    headers: [
                      { name: "From", value: "Alice <alice@example.com>" },
                      { name: "Subject", value: "Test Subject" },
                      { name: "To", value: "bob@example.com" },
                    ],
                    mimeType: "text/html",
                    body: { data: "", size: 0 },
                  },
                },
              ],
            });
          }
          return Promise.resolve({});
        },
      );

      // No existing threads in DB
      mockSelect.mockResolvedValueOnce([]);

      const result = await syncInbox(account);

      expect(result.threads).toHaveLength(1);
      expect(result.threads[0]!.id).toBe("t-1");
      expect(result.threads[0]!.subject).toBe("Test Subject");
      expect(result.threads[0]!.is_read).toBe(false); // has UNREAD label

      // New unread thread should appear in newThreads
      expect(result.newThreads).toHaveLength(1);
      expect(result.newThreads[0]!.id).toBe("t-1");

      // Verify DB operations
      expect(mockUpsertThread).toHaveBeenCalledTimes(1);
      expect(mockSetThreadLabelsBatch).toHaveBeenCalledWith("acc-1", [
        { threadId: "t-1", labelIds: ["INBOX", "UNREAD"] },
      ]);
      expect(mockUpsertMessage).toHaveBeenCalledTimes(1);
    });

    it("skips threads with pending operations", async () => {
      const account = makeAccount();

      mockAuthenticatedFetch.mockImplementation(
        (_acct: unknown, url: string) => {
          if (url.startsWith("/threads?")) {
            return Promise.resolve({
              threads: [{ id: "t-pending", snippet: "Pending" }],
            });
          }
          return Promise.resolve({});
        },
      );

      mockSelect.mockResolvedValueOnce([]); // no existing threads
      mockHasPendingOps.mockResolvedValueOnce(true);

      const result = await syncInbox(account);

      expect(result.threads).toHaveLength(0);
      expect(mockUpsertThread).not.toHaveBeenCalled();
    });

    it("does not add already-existing read threads to newThreads", async () => {
      const account = makeAccount();

      mockAuthenticatedFetch.mockImplementation(
        (_acct: unknown, url: string) => {
          if (url.startsWith("/threads?")) {
            return Promise.resolve({
              threads: [{ id: "t-existing", snippet: "Old" }],
            });
          }
          if (url === "/threads/t-existing?format=full") {
            return Promise.resolve({
              id: "t-existing",
              snippet: "Old thread",
              messages: [
                {
                  id: "m-old",
                  threadId: "t-existing",
                  internalDate: String(Date.now()),
                  snippet: "Old",
                  labelIds: ["INBOX"],
                  payload: {
                    headers: [
                      { name: "From", value: "sender@example.com" },
                      { name: "Subject", value: "Old Subject" },
                    ],
                    mimeType: "text/plain",
                    body: { data: "", size: 0 },
                  },
                },
              ],
            });
          }
          return Promise.resolve({});
        },
      );

      // Thread already exists in DB
      mockSelect.mockResolvedValueOnce([{ id: "t-existing" }]);

      const result = await syncInbox(account);

      expect(result.threads).toHaveLength(1);
      // Already existing, so not in newThreads
      expect(result.newThreads).toHaveLength(0);
    });
  });
});
