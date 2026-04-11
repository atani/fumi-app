import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useComposerStore } from "../../stores/composerStore";

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0 });
const mockSelect = vi.fn().mockResolvedValue([]);

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}));

// Import after mocks are set up
const { saveDraft, loadDrafts, deleteDraft, startAutoSave, stopAutoSave } =
  await import("./draftAutoSave");

describe("draftAutoSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useComposerStore.setState({
      isOpen: false,
      mode: "compose",
      draftId: null,
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
      replyToMessage: null,
      inReplyTo: null,
      references: null,
    });
  });

  afterEach(() => {
    stopAutoSave();
    vi.useRealTimers();
  });

  describe("saveDraft", () => {
    it("should upsert a draft to the database", async () => {
      await saveDraft("draft-1", "account-1", {
        mode: "compose",
        to: "test@example.com",
        cc: "",
        bcc: "",
        subject: "Test Subject",
        body: "Test body",
        replyToMessageId: null,
        inReplyTo: null,
        references: null,
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("INSERT INTO local_drafts");
      expect(sql).toContain("ON CONFLICT(id) DO UPDATE");
      expect(params[0]).toBe("draft-1");
      expect(params[1]).toBe("account-1");
      expect(params[3]).toBe("test@example.com");
      expect(params[6]).toBe("Test Subject");
    });
  });

  describe("loadDrafts", () => {
    it("should load all drafts when no accountId provided", async () => {
      mockSelect.mockResolvedValueOnce([
        { id: "draft-1", subject: "Test" },
      ]);

      const drafts = await loadDrafts();

      expect(mockSelect).toHaveBeenCalledTimes(1);
      const [sql] = mockSelect.mock.calls[0] as [string];
      expect(sql).toContain("SELECT * FROM local_drafts");
      expect(sql).not.toContain("account_id");
      expect(drafts).toHaveLength(1);
    });

    it("should filter by accountId when provided", async () => {
      mockSelect.mockResolvedValueOnce([]);

      await loadDrafts("account-1");

      const [sql, params] = mockSelect.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("account_id = $1");
      expect(params[0]).toBe("account-1");
    });
  });

  describe("deleteDraft", () => {
    it("should delete a draft by id", async () => {
      await deleteDraft("draft-1");

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("DELETE FROM local_drafts");
      expect(params[0]).toBe("draft-1");
    });
  });

  describe("startAutoSave / stopAutoSave", () => {
    it("should auto-save after 3s debounce when composer state changes", async () => {
      useComposerStore.setState({
        isOpen: true,
        draftId: "draft-1",
        mode: "compose",
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
      });

      startAutoSave(() => "account-1");

      // Simulate typing
      useComposerStore.setState({ subject: "Hello" });

      // Before debounce fires, no save
      expect(mockExecute).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(3000);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("INSERT INTO local_drafts");
      expect(params[6]).toBe("Hello");
    });

    it("should not save when composer is closed", async () => {
      useComposerStore.setState({
        isOpen: false,
        draftId: null,
      });

      startAutoSave(() => "account-1");

      useComposerStore.setState({ subject: "Hello" });

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("should debounce rapid changes", async () => {
      useComposerStore.setState({
        isOpen: true,
        draftId: "draft-1",
        mode: "compose",
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
      });

      startAutoSave(() => "account-1");

      useComposerStore.setState({ subject: "H" });
      await vi.advanceTimersByTimeAsync(1000);
      useComposerStore.setState({ subject: "He" });
      await vi.advanceTimersByTimeAsync(1000);
      useComposerStore.setState({ subject: "Hel" });
      await vi.advanceTimersByTimeAsync(3000);

      // Only one save should happen (the last debounced one)
      expect(mockExecute).toHaveBeenCalledTimes(1);
      const [, params] = mockExecute.mock.calls[0] as [string, unknown[]];
      expect(params[6]).toBe("Hel");
    });

    it("should call onSaved callback after successful save", async () => {
      useComposerStore.setState({
        isOpen: true,
        draftId: "draft-1",
        mode: "compose",
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
      });

      const onSaved = vi.fn();
      startAutoSave(() => "account-1", onSaved);

      useComposerStore.setState({ body: "test content" });

      await vi.advanceTimersByTimeAsync(3000);

      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("should stop saving after stopAutoSave is called", async () => {
      useComposerStore.setState({
        isOpen: true,
        draftId: "draft-1",
        mode: "compose",
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
      });

      startAutoSave(() => "account-1");

      useComposerStore.setState({ subject: "Hello" });

      stopAutoSave();

      await vi.advanceTimersByTimeAsync(3000);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("should not save again when snapshot has not changed after initial save", async () => {
      useComposerStore.setState({
        isOpen: true,
        draftId: "draft-1",
        mode: "compose",
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
      });

      startAutoSave(() => "account-1");

      // First change triggers a save
      useComposerStore.setState({ subject: "Hello" });
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockExecute).toHaveBeenCalledTimes(1);

      mockExecute.mockClear();

      // Setting same value should not trigger another save
      useComposerStore.setState({ subject: "Hello" });
      await vi.advanceTimersByTimeAsync(3000);

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });
});
