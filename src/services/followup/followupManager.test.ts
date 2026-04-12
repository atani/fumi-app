import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addFollowUp,
  removeFollowUp,
  getFollowUp,
  checkFollowUps,
} from "./followupManager";
import type { Account, FollowUpReminder, Message } from "../../types";

vi.mock("../db/connection", () => ({
  getDb: vi.fn(),
}));

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    email: "me@example.com",
    name: "Me",
    picture: "",
    provider: "gmail_api",
    access_token: null,
    refresh_token: null,
    token_expiry: null,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    account_id: "acc-1",
    from_address: "me@example.com",
    from_name: null,
    to_addresses: null,
    cc_addresses: null,
    bcc_addresses: null,
    subject: "Hello",
    snippet: null,
    body_html: null,
    body_text: null,
    date: null,
    is_read: true,
    has_attachments: false,
    header_message_id: null,
    auth_results: null,
    list_unsubscribe: null,
    list_unsubscribe_post: null,
    imap_uid: null,
    imap_folder: null,
    message_id_header: null,
    references_header: null,
    in_reply_to_header: null,
    ...overrides,
  };
}

function makeReminder(overrides: Partial<FollowUpReminder> = {}): FollowUpReminder {
  return {
    id: "followup-thread-1-acc-1",
    thread_id: "thread-1",
    account_id: "acc-1",
    remind_after_hours: 24,
    created_at: "2026-01-01T00:00:00Z",
    reminded_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("addFollowUp", () => {
  it("inserts a reminder keyed by thread and account", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await addFollowUp("thread-1", "acc-1", 48);

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO follow_up_reminders"),
      ["followup-thread-1-acc-1", "thread-1", "acc-1", 48],
    );
  });
});

describe("removeFollowUp", () => {
  it("deletes reminders for the given thread+account", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await removeFollowUp("thread-1", "acc-1");

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM follow_up_reminders"),
      ["thread-1", "acc-1"],
    );
  });
});

describe("getFollowUp", () => {
  it("returns the active reminder when one exists", async () => {
    const reminder = makeReminder();
    const selectMock = vi.fn().mockResolvedValue([reminder]);
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    const result = await getFollowUp("thread-1", "acc-1");
    expect(result).toEqual(reminder);
  });

  it("returns null when no reminder is set", async () => {
    const selectMock = vi.fn().mockResolvedValue([]);
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    const result = await getFollowUp("thread-1", "acc-1");
    expect(result).toBeNull();
  });
});

describe("checkFollowUps", () => {
  it("fires reminders whose last sent message is older than the threshold", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const sentAt = new Date(
      now.getTime() - 30 * 60 * 60 * 1000,
    ).toISOString();

    const reminder = makeReminder({ remind_after_hours: 24 });
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const selectMock = vi
      .fn()
      // reminder list
      .mockResolvedValueOnce([reminder])
      // thread messages: a prior inbound + our sent email, no later reply
      .mockResolvedValueOnce([
        makeMessage({
          id: "m0",
          from_address: "them@example.com",
          date: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(),
        }),
        makeMessage({
          id: "m1",
          from_address: "me@example.com",
          subject: "Status update",
          date: sentAt,
        }),
      ]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    const fired = await checkFollowUps(makeAccount());
    expect(fired).toHaveLength(1);
    expect(fired[0]!.subject).toBe("Status update");
    expect(fired[0]!.reminder.id).toBe(reminder.id);

    // Reminder marked as reminded
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE follow_up_reminders"),
      [reminder.id],
    );
  });

  it("does not fire reminders when the threshold has not elapsed", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const recent = new Date(
      now.getTime() - 4 * 60 * 60 * 1000,
    ).toISOString();

    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 0 });
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([makeReminder({ remind_after_hours: 24 })])
      .mockResolvedValueOnce([
        makeMessage({
          from_address: "me@example.com",
          date: recent,
        }),
      ]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    const fired = await checkFollowUps(makeAccount());
    expect(fired).toHaveLength(0);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("auto-clears a reminder when a reply arrived after the sent message", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const reminder = makeReminder();
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([reminder])
      .mockResolvedValueOnce([
        makeMessage({
          id: "m1",
          from_address: "me@example.com",
          date: new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString(),
        }),
        makeMessage({
          id: "m2",
          from_address: "them@example.com",
          date: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
        }),
      ]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    const fired = await checkFollowUps(makeAccount());
    expect(fired).toHaveLength(0);
    // Reminder still cleared in DB
    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE follow_up_reminders"),
      [reminder.id],
    );
  });

  it("skips reminders with no user-sent messages in the thread", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 0 });
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([makeReminder()])
      .mockResolvedValueOnce([
        makeMessage({
          from_address: "them@example.com",
          date: "2026-01-01T00:00:00Z",
        }),
      ]);

    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    const fired = await checkFollowUps(makeAccount());
    expect(fired).toHaveLength(0);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns an empty array when there are no pending reminders", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 0 });
    const selectMock = vi.fn().mockResolvedValueOnce([]);
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: selectMock,
    } as never);

    const fired = await checkFollowUps(makeAccount());
    expect(fired).toEqual([]);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });
});
