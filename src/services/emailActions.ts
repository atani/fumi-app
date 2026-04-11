import type { Account } from "../types";
import { authenticatedFetch } from "./gmail/api";
import { useThreadStore } from "../stores/threadStore";
import { useUIStore } from "../stores/uiStore";
import { getDb } from "./db/connection";
import { enqueueOperation } from "./queue/queueProcessor";

/**
 * Modify a Gmail thread's labels via the API, or enqueue if offline.
 */
async function modifyThreadLabels(
  account: Account,
  threadId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  if (!useUIStore.getState().isOnline) {
    await enqueueOperation(account.id, "modifyLabels", {
      threadId,
      addLabelIds,
      removeLabelIds,
    });
    return;
  }

  await authenticatedFetch(account, `/threads/${threadId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

/**
 * Persist is_read / is_starred changes to the local SQLite DB.
 */
async function updateThreadInDb(
  threadId: string,
  accountId: string,
  updates: { is_read?: boolean; is_starred?: boolean },
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (updates.is_read !== undefined) {
    setClauses.push(`is_read = $${idx}`);
    params.push(updates.is_read ? 1 : 0);
    idx++;
  }
  if (updates.is_starred !== undefined) {
    setClauses.push(`is_starred = $${idx}`);
    params.push(updates.is_starred ? 1 : 0);
    idx++;
  }

  if (setClauses.length === 0) return;

  params.push(threadId, accountId);
  await db.execute(
    `UPDATE threads SET ${setClauses.join(", ")} WHERE id = $${idx} AND account_id = $${idx + 1}`,
    params,
  );
}

/**
 * Remove a label from a thread in the local DB.
 */
async function removeThreadLabelInDb(
  threadId: string,
  accountId: string,
  labelId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2 AND label_id = $3",
    [threadId, accountId, labelId],
  );
}

/**
 * Add a label to a thread in the local DB.
 */
async function addThreadLabelInDb(
  threadId: string,
  accountId: string,
  labelId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, $2, $3)",
    [threadId, labelId, accountId],
  );
}

// ---------------------------------------------------------------------------
// Public email action functions
// ---------------------------------------------------------------------------

/**
 * Mark a thread as read. Optimistic UI update, then Gmail API + local DB.
 * When offline, API call is enqueued; local DB is always updated immediately.
 */
export async function markAsRead(
  account: Account,
  threadId: string,
): Promise<void> {
  // Optimistic UI
  useThreadStore.getState().updateThread(threadId, { is_read: true });

  // API (or enqueue) + DB concurrently
  await Promise.all([
    modifyThreadLabels(account, threadId, [], ["UNREAD"]),
    updateThreadInDb(threadId, account.id, { is_read: true }),
  ]);
}

/**
 * Mark a thread as unread. Optimistic UI update, then Gmail API + local DB.
 */
export async function markAsUnread(
  account: Account,
  threadId: string,
): Promise<void> {
  useThreadStore.getState().updateThread(threadId, { is_read: false });

  await Promise.all([
    modifyThreadLabels(account, threadId, ["UNREAD"], []),
    updateThreadInDb(threadId, account.id, { is_read: false }),
  ]);
}

/**
 * Toggle star on a thread. Optimistic UI update, then Gmail API + local DB.
 */
export async function toggleStar(
  account: Account,
  threadId: string,
  currentlyStarred: boolean,
): Promise<void> {
  const newStarred = !currentlyStarred;
  useThreadStore.getState().updateThread(threadId, { is_starred: newStarred });

  const add = newStarred ? ["STARRED"] : [];
  const remove = newStarred ? [] : ["STARRED"];

  await Promise.all([
    modifyThreadLabels(account, threadId, add, remove),
    updateThreadInDb(threadId, account.id, { is_starred: newStarred }),
  ]);
}

/**
 * Archive a thread (remove from INBOX). Optimistic UI removes from list.
 */
export async function archiveThread(
  account: Account,
  threadId: string,
): Promise<void> {
  useThreadStore.getState().removeThread(threadId);

  await Promise.all([
    modifyThreadLabels(account, threadId, [], ["INBOX"]),
    removeThreadLabelInDb(threadId, account.id, "INBOX"),
  ]);
}

/**
 * Trash a thread. Optimistic UI removes from list.
 */
export async function trashThread(
  account: Account,
  threadId: string,
): Promise<void> {
  useThreadStore.getState().removeThread(threadId);

  await Promise.all([
    modifyThreadLabels(account, threadId, ["TRASH"], ["INBOX"]),
    addThreadLabelInDb(threadId, account.id, "TRASH"),
    removeThreadLabelInDb(threadId, account.id, "INBOX"),
  ]);
}
