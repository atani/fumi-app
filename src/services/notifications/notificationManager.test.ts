import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Thread } from "../../types";

// Mocks ---------------------------------------------------------------------

vi.mock("../db/connection", () => ({
  getDb: vi.fn(),
}));

const sendNotificationMock = vi.fn();
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
}));

// Helpers -------------------------------------------------------------------

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    account_id: "acc-1",
    snippet: "hello",
    subject: "Subject",
    last_message_at: null,
    message_count: 1,
    is_read: false,
    is_starred: false,
    is_muted: false,
    snoozed_until: null,
    ...overrides,
  };
}

type NotificationModule = typeof import("./notificationManager");

async function grantPermissionAndEnableTauri(): Promise<NotificationModule> {
  // Satisfy isTauri()
  (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ =
    {};
  // Pretend the window is not focused so notifications actually fire
  vi.spyOn(document, "hasFocus").mockReturnValue(false);

  // Use a single module instance so initNotifications() and notifyNewMessages()
  // share the same permissionGranted flag.
  const mod = await import("./notificationManager");
  await mod.initNotifications();
  return mod;
}

// Tests ---------------------------------------------------------------------

describe("notificationManager", () => {
  beforeEach(async () => {
    vi.resetModules();
    sendNotificationMock.mockReset();
    // Reset tauri flag & doc focus for each test
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown })
      .__TAURI_INTERNALS__;
  });

  it("getVips returns rows from the notification_vips table", async () => {
    const selectMock = vi
      .fn()
      .mockResolvedValue([{ email: "ceo@example.com", account_id: "acc-1" }]);
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    const { getVips } = await import("./notificationManager");
    const vips = await getVips("acc-1");

    expect(vips).toEqual([{ email: "ceo@example.com", account_id: "acc-1" }]);
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM notification_vips"),
      ["acc-1"],
    );
  });

  it("addVip lowercases and trims the email before insert", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    const { addVip } = await import("./notificationManager");
    await addVip("acc-1", "  CEO@Example.COM  ");

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO notification_vips"),
      ["ceo@example.com", "acc-1"],
    );
  });

  it("removeVip deletes with a normalized email", async () => {
    const executeMock = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: executeMock,
      select: vi.fn().mockResolvedValue([]),
    } as never);

    const { removeVip } = await import("./notificationManager");
    await removeVip("acc-1", " CEO@Example.com ");

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM notification_vips"),
      ["ceo@example.com", "acc-1"],
    );
  });

  it("notifyNewMessages is a no-op outside Tauri", async () => {
    // Do not set __TAURI_INTERNALS__, do not call initNotifications
    const { notifyNewMessages } = await import("./notificationManager");
    await notifyNewMessages([makeThread()], "acc-1");
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("notifyNewMessages skips muted threads", async () => {
    const { notifyNewMessages } = await grantPermissionAndEnableTauri();
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await notifyNewMessages([makeThread({ is_muted: true })]);

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("notifyNewMessages sends a single-subject notification when one thread is eligible", async () => {
    const { notifyNewMessages } = await grantPermissionAndEnableTauri();
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await notifyNewMessages([
      makeThread({ id: "t1", subject: "Hello", snippet: "snip" }),
      makeThread({ id: "t2", is_muted: true }),
    ]);

    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Hello",
      body: "snip",
    });
  });

  it("notifyNewMessages filters to VIP senders when VIPs are configured", async () => {
    const { notifyNewMessages } = await grantPermissionAndEnableTauri();

    // First select call: VIP list. Second select call: sender lookup.
    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        { email: "vip@example.com", account_id: "acc-1" },
      ])
      .mockResolvedValueOnce([
        { thread_id: "t1", from_address: "VIP@example.com" },
        { thread_id: "t2", from_address: "other@example.com" },
      ]);
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    await notifyNewMessages(
      [
        makeThread({ id: "t1", subject: "From VIP" }),
        makeThread({ id: "t2", subject: "From rando" }),
      ],
      "acc-1",
    );

    // Only the VIP-originated thread fires — a single-subject notification.
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "From VIP",
      body: expect.any(String),
    });
  });

  it("notifyNewMessages suppresses the notification when no thread matches a VIP", async () => {
    const { notifyNewMessages } = await grantPermissionAndEnableTauri();

    const selectMock = vi
      .fn()
      .mockResolvedValueOnce([
        { email: "vip@example.com", account_id: "acc-1" },
      ])
      .mockResolvedValueOnce([
        { thread_id: "t1", from_address: "other@example.com" },
      ]);
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      select: selectMock,
    } as never);

    await notifyNewMessages([makeThread({ id: "t1" })], "acc-1");

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("notifyNewMessages groups multiple eligible threads into a summary", async () => {
    const { notifyNewMessages } = await grantPermissionAndEnableTauri();
    const { getDb } = await import("../db/connection");
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      // No accountId passed below, so VIP fetch should not occur
      select: vi.fn().mockResolvedValue([]),
    } as never);

    await notifyNewMessages([
      makeThread({ id: "t1", subject: "A" }),
      makeThread({ id: "t2", subject: "B" }),
      makeThread({ id: "t3", subject: "C" }),
    ]);

    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    const call = sendNotificationMock.mock.calls[0]![0] as {
      title: string;
      body: string;
    };
    expect(call.title).toBe("3 new messages");
    expect(call.body).toContain("A");
    expect(call.body).toContain("B");
    expect(call.body).toContain("C");
  });
});
