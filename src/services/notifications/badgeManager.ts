import { getDb } from "../db/connection";

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
