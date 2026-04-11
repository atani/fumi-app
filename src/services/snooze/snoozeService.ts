import type { Account } from "../../types";
import { authenticatedFetch } from "../gmail/api";
import { getDb } from "../db/connection";
import { useThreadStore } from "../../stores/threadStore";

/**
 * Snooze a thread until the given ISO date string.
 * Removes the INBOX label via Gmail API, sets snoozed_until in local DB,
 * and removes the thread from the current list.
 */
export async function snoozeThread(
  account: Account,
  threadId: string,
  until: string,
): Promise<void> {
  // Optimistic UI: remove from thread list
  useThreadStore.getState().removeThread(threadId);

  const db = await getDb();

  await Promise.all([
    // Remove INBOX label via Gmail API
    authenticatedFetch(account, `/threads/${threadId}/modify`, {
      method: "POST",
      body: JSON.stringify({
        addLabelIds: [],
        removeLabelIds: ["INBOX"],
      }),
    }),
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
}

/**
 * Unsnooze a thread: add INBOX label back, clear snoozed_until.
 */
export async function unsnoozeThread(
  account: Account,
  threadId: string,
): Promise<void> {
  const db = await getDb();

  await Promise.all([
    // Add INBOX label back via Gmail API
    authenticatedFetch(account, `/threads/${threadId}/modify`, {
      method: "POST",
      body: JSON.stringify({
        addLabelIds: ["INBOX"],
        removeLabelIds: [],
      }),
    }),
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
