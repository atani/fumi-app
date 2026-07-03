import type { Thread, NotificationVip } from "../../types";
import { getDb } from "../db/connection";
import i18n from "../../i18n";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let permissionGranted = false;

export async function initNotifications(): Promise<void> {
  if (!isTauri()) return;

  const { isPermissionGranted, requestPermission } = await import(
    "@tauri-apps/plugin-notification"
  );

  permissionGranted = await isPermissionGranted();

  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }
}

function isWindowFocused(): boolean {
  return typeof document !== "undefined" && document.hasFocus();
}

// ---------------------------------------------------------------------------
// VIP management
// ---------------------------------------------------------------------------

export async function getVips(accountId: string): Promise<NotificationVip[]> {
  const db = await getDb();
  return db.select<NotificationVip[]>(
    "SELECT email, account_id FROM notification_vips WHERE account_id = $1",
    [accountId],
  );
}

export async function addVip(accountId: string, email: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO notification_vips (email, account_id) VALUES ($1, $2)",
    [email.toLowerCase().trim(), accountId],
  );
}

export async function removeVip(accountId: string, email: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM notification_vips WHERE email = $1 AND account_id = $2",
    [email.toLowerCase().trim(), accountId],
  );
}

// ---------------------------------------------------------------------------
// Check if a thread's sender matches any VIP
// ---------------------------------------------------------------------------

async function getThreadSenderEmails(
  accountId: string,
  threadIds: string[],
): Promise<Map<string, string[]>> {
  if (threadIds.length === 0) return new Map();
  const db = await getDb();
  const placeholders = threadIds.map((_, i) => `$${i + 2}`).join(",");
  const rows = await db.select<{ thread_id: string; from_address: string }[]>(
    `SELECT DISTINCT thread_id, from_address FROM messages
     WHERE account_id = $1 AND thread_id IN (${placeholders}) AND from_address IS NOT NULL`,
    [accountId, ...threadIds],
  );

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.thread_id) ?? [];
    existing.push(row.from_address.toLowerCase());
    map.set(row.thread_id, existing);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function notifyFollowUp(subject: string): Promise<void> {
  if (!isTauri() || !permissionGranted) return;

  const { sendNotification } = await import("@tauri-apps/plugin-notification");

  sendNotification({
    title: i18n.t("notifications.followUpTitle"),
    body: i18n.t("notifications.followUpBody", { subject }),
  });
}

/**
 * Notify that a message failed to send. Used for background (undo-delay) sends,
 * where the composer is already closed so an inline error would be invisible.
 */
export async function notifySendFailed(subject: string): Promise<void> {
  if (!isTauri() || !permissionGranted) return;

  const { sendNotification } = await import("@tauri-apps/plugin-notification");

  sendNotification({
    title: i18n.t("notifications.sendFailedTitle"),
    body: i18n.t("notifications.sendFailedBody", {
      subject: subject || i18n.t("notifications.noSubject"),
    }),
  });
}

/**
 * Notify about new messages, filtering out muted threads and applying VIP rules.
 * If VIPs are configured for the account, only notify for threads from VIP senders.
 * If no VIPs are configured, notify for all non-muted threads.
 */
export async function notifyNewMessages(
  newThreads: Thread[],
  accountId?: string,
): Promise<void> {
  if (!isTauri() || !permissionGranted) return;
  if (newThreads.length === 0) return;
  if (isWindowFocused()) return;

  // Filter out muted threads
  let eligible = newThreads.filter((t) => !t.is_muted);
  if (eligible.length === 0) return;

  // Apply VIP filtering if accountId is provided
  if (accountId) {
    const vips = await getVips(accountId);
    if (vips.length > 0) {
      const vipEmails = new Set(vips.map((v) => v.email.toLowerCase()));
      const senderMap = await getThreadSenderEmails(
        accountId,
        eligible.map((t) => t.id),
      );

      eligible = eligible.filter((t) => {
        const senders = senderMap.get(t.id) ?? [];
        return senders.some((email) => vipEmails.has(email));
      });

      if (eligible.length === 0) return;
    }
  }

  const { sendNotification } = await import("@tauri-apps/plugin-notification");

  if (eligible.length === 1) {
    const thread = eligible[0]!;
    sendNotification({
      title: thread.subject || i18n.t("notifications.noSubject"),
      body: thread.snippet || "",
    });
  } else {
    sendNotification({
      title: i18n.t("notifications.newMessages", { count: eligible.length }),
      body: eligible
        .slice(0, 3)
        .map((t) => t.subject || i18n.t("notifications.noSubject"))
        .join(", "),
    });
  }
}
