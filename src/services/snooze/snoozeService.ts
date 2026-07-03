import type { Account } from "../../types";
import { getDb } from "../db/connection";
import { useThreadStore } from "../../stores/threadStore";
import { modifyThreadLabels } from "../emailActions";

/**
 * Snooze a thread until the given ISO date string.
 * Removes the INBOX label (offline-queued when offline), sets snoozed_until in
 * local DB, and removes the thread from the current list. Reverts the optimistic
 * UI + local label changes if the label move or DB writes fail, so we never end
 * up "snoozed locally but still in INBOX on Gmail" (which reappears on next sync).
 */
export async function snoozeThread(
  account: Account,
  threadId: string,
  until: string,
): Promise<void> {
  const cachedThreads = useThreadStore.getState().threads;
  // Optimistic UI: remove from thread list
  useThreadStore.getState().removeThread(threadId);

  const db = await getDb();

  try {
    await Promise.all([
      // Remove INBOX label (goes through the shared offline-queue path)
      modifyThreadLabels(account, threadId, [], ["INBOX"]),
      // Set snoozed_until in local DB
      db.execute(
        "UPDATE threads SET snoozed_until = $1 WHERE id = $2 AND account_id = $3",
        [until, threadId, account.id],
      ),
      // Remove INBOX label from thread_labels
      db.execute(
        "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2 AND label_id = 'INBOX'",
        [threadId, account.id],
      ),
      // Add SNOOZED label to thread_labels
      db.execute(
        "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, 'SNOOZED', $2)",
        [threadId, account.id],
      ),
    ]);
  } catch (err) {
    console.error("snoozeThread failed, reverting optimistic changes:", err);
    useThreadStore.getState().setThreads(cachedThreads);
    // Best-effort revert of the local DB changes so DB and Gmail stay consistent.
    await Promise.all([
      db
        .execute(
          "UPDATE threads SET snoozed_until = NULL WHERE id = $1 AND account_id = $2",
          [threadId, account.id],
        )
        .catch((e: unknown) =>
          console.error("snoozeThread revert: clear snoozed_until failed:", e),
        ),
      db
        .execute(
          "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2 AND label_id = 'SNOOZED'",
          [threadId, account.id],
        )
        .catch((e: unknown) =>
          console.error("snoozeThread revert: remove SNOOZED failed:", e),
        ),
      db
        .execute(
          "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, 'INBOX', $2)",
          [threadId, account.id],
        )
        .catch((e: unknown) =>
          console.error("snoozeThread revert: restore INBOX failed:", e),
        ),
    ]);
    throw err;
  }
}

/**
 * Unsnooze a thread: add INBOX label back (offline-queued when offline),
 * clear snoozed_until.
 */
export async function unsnoozeThread(
  account: Account,
  threadId: string,
): Promise<void> {
  const db = await getDb();

  await Promise.all([
    // Add INBOX label back (goes through the shared offline-queue path)
    modifyThreadLabels(account, threadId, ["INBOX"], []),
    // Clear snoozed_until
    db.execute(
      "UPDATE threads SET snoozed_until = NULL WHERE id = $1 AND account_id = $2",
      [threadId, account.id],
    ),
    // Remove SNOOZED label
    db.execute(
      "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2 AND label_id = 'SNOOZED'",
      [threadId, account.id],
    ),
    // Add INBOX label back
    db.execute(
      "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, 'INBOX', $2)",
      [threadId, account.id],
    ),
  ]);
}

/**
 * Check for threads whose snooze time has passed and unsnooze them.
 */
export async function checkSnoozedThreads(
  account: Account,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const expired = await db.select<{ id: string; account_id: string }[]>(
    "SELECT id, account_id FROM threads WHERE account_id = $1 AND snoozed_until IS NOT NULL AND snoozed_until <= $2",
    [account.id, now],
  );

  for (const thread of expired) {
    await unsnoozeThread(account, thread.id);
  }
}
