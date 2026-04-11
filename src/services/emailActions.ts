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
 * Persist is_read / is_starred / is_muted changes to the local SQLite DB.
 */
async function updateThreadInDb(
  threadId: string,
  accountId: string,
  updates: { is_read?: boolean; is_starred?: boolean; is_muted?: boolean },
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
  if (updates.is_muted !== undefined) {
    setClauses.push(`is_muted = $${idx}`);
    params.push(updates.is_muted ? 1 : 0);
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

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

/**
 * Archive multiple threads. Optimistic UI removes all from list.
 */
export async function archiveThreads(
  account: Account,
  threadIds: string[],
): Promise<void> {
  useThreadStore.getState().removeThreads(threadIds);

  await Promise.all(
    threadIds.flatMap((threadId) => [
      modifyThreadLabels(account, threadId, [], ["INBOX"]),
      removeThreadLabelInDb(threadId, account.id, "INBOX"),
    ]),
  );
}

/**
 * Trash multiple threads. Optimistic UI removes all from list.
 */
export async function trashThreads(
  account: Account,
  threadIds: string[],
): Promise<void> {
  useThreadStore.getState().removeThreads(threadIds);

  await Promise.all(
    threadIds.flatMap((threadId) => [
      modifyThreadLabels(account, threadId, ["TRASH"], ["INBOX"]),
      addThreadLabelInDb(threadId, account.id, "TRASH"),
      removeThreadLabelInDb(threadId, account.id, "INBOX"),
    ]),
  );
}

/**
 * Mark multiple threads as read. Optimistic UI update, then Gmail API + local DB.
 */
export async function markThreadsAsRead(
  account: Account,
  threadIds: string[],
): Promise<void> {
  useThreadStore.getState().updateThreads(threadIds, { is_read: true });

  await Promise.all(
    threadIds.flatMap((threadId) => [
      modifyThreadLabels(account, threadId, [], ["UNREAD"]),
      updateThreadInDb(threadId, account.id, { is_read: true }),
    ]),
  );
}

/**
 * Mark multiple threads as unread. Optimistic UI update, then Gmail API + local DB.
 */
export async function markThreadsAsUnread(
  account: Account,
  threadIds: string[],
): Promise<void> {
  useThreadStore.getState().updateThreads(threadIds, { is_read: false });

  await Promise.all(
    threadIds.flatMap((threadId) => [
      modifyThreadLabels(account, threadId, ["UNREAD"], []),
      updateThreadInDb(threadId, account.id, { is_read: false }),
    ]),
  );
}

/**
 * Star multiple threads. Optimistic UI update, then Gmail API + local DB.
 */
export async function starThreads(
  account: Account,
  threadIds: string[],
): Promise<void> {
  useThreadStore.getState().updateThreads(threadIds, { is_starred: true });

  await Promise.all(
    threadIds.flatMap((threadId) => [
      modifyThreadLabels(account, threadId, ["STARRED"], []),
      updateThreadInDb(threadId, account.id, { is_starred: true }),
    ]),
  );
}

/**
 * Unstar multiple threads. Optimistic UI update, then Gmail API + local DB.
 */
export async function unstarThreads(
  account: Account,
  threadIds: string[],
): Promise<void> {
  useThreadStore.getState().updateThreads(threadIds, { is_starred: false });

  await Promise.all(
    threadIds.flatMap((threadId) => [
      modifyThreadLabels(account, threadId, [], ["STARRED"]),
      updateThreadInDb(threadId, account.id, { is_starred: false }),
    ]),
  );
}

/**
 * Mute a thread: sets is_muted=1 and archives (removes from INBOX).
 * Muted threads suppress notifications during delta sync.
 */
export async function muteThread(
  account: Account,
  threadId: string,
): Promise<void> {
  useThreadStore.getState().updateThread(threadId, { is_muted: true });
  useThreadStore.getState().removeThread(threadId);

  await Promise.all([
    modifyThreadLabels(account, threadId, [], ["INBOX"]),
    updateThreadInDb(threadId, account.id, { is_muted: true }),
    removeThreadLabelInDb(threadId, account.id, "INBOX"),
  ]);
}

/**
 * Unmute a thread: sets is_muted=0 and moves back to INBOX.
 */
export async function unmuteThread(
  account: Account,
  threadId: string,
): Promise<void> {
  useThreadStore.getState().updateThread(threadId, { is_muted: false });

  await Promise.all([
    modifyThreadLabels(account, threadId, ["INBOX"], []),
    updateThreadInDb(threadId, account.id, { is_muted: false }),
    addThreadLabelInDb(threadId, account.id, "INBOX"),
  ]);
}
