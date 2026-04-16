import { getDb } from "../db/connection";

/**
 * Returns a map of `accountId -> inbox unread count` for every account that
 * has at least one unread inbox thread. Accounts with zero unread are
 * omitted; callers should treat missing keys as zero.
 */
export async function getUnreadCountsByAccount(): Promise<
  Record<string, number>
> {
  const db = await getDb();
  const rows = await db.select<{ account_id: string; count: number }[]>(
    `SELECT t.account_id as account_id, COUNT(*) as count
       FROM threads t
       JOIN thread_labels tl ON t.id = tl.thread_id AND t.account_id = tl.account_id
      WHERE tl.label_id = 'INBOX' AND t.is_read = 0
      GROUP BY t.account_id`,
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.account_id] = row.count;
  }
  return result;
}

export async function updateBadgeCount(accountId: string): Promise<void> {
  const db = await getDb();

  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM threads t
     JOIN thread_labels tl ON t.id = tl.thread_id AND t.account_id = tl.account_id
     WHERE t.account_id = $1 AND tl.label_id = 'INBOX' AND t.is_read = 0`,
    [accountId],
  );

  const unreadCount = rows[0]?.count ?? 0;

  if (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  ) {
    try {
      const { sendNotification } = await import(
        "@tauri-apps/plugin-notification"
      );
      // Use setBadgeCount when available in Tauri v2 notification plugin.
      // For now, update the tray tooltip to show unread count via Tauri commands.
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_tray_tooltip", {
        tooltip: unreadCount > 0 ? `Fumi - ${unreadCount} unread` : "Fumi",
      });
      void sendNotification;
    } catch {
      // Tray tooltip update is best-effort
    }
  }
}
