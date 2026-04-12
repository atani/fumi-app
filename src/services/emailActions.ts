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
 * Reverts the removal if the API/DB call fails.
 */
export async function archiveThread(
  account: Account,
  threadId: string,
): Promise<void> {
  const cachedThreads = useThreadStore.getState().threads;
  useThreadStore.getState().removeThread(threadId);

  try {
    await Promise.all([
      modifyThreadLabels(account, threadId, [], ["INBOX"]),
      removeThreadLabelInDb(threadId, account.id, "INBOX"),
    ]);
  } catch (err) {
    console.error("archiveThread failed, reverting optimistic removal:", err);
    useThreadStore.getState().setThreads(cachedThreads);
    // Best-effort revert of the local DB label removal
    await addThreadLabelInDb(threadId, account.id, "INBOX").catch((dbErr) => {
      console.error("archiveThread revert: failed to restore INBOX label in DB:", dbErr);
    });
    throw err;
  }
}

/**
 * Trash a thread. Optimistic UI removes from list.
 * Reverts the removal if the API/DB call fails.
 */
export async function trashThread(
  account: Account,
  threadId: string,
): Promise<void> {
  const cachedThreads = useThreadStore.getState().threads;
  useThreadStore.getState().removeThread(threadId);

  try {
    await Promise.all([
      modifyThreadLabels(account, threadId, ["TRASH"], ["INBOX"]),
      addThreadLabelInDb(threadId, account.id, "TRASH"),
      removeThreadLabelInDb(threadId, account.id, "INBOX"),
    ]);
  } catch (err) {
    console.error("trashThread failed, reverting optimistic removal:", err);
    useThreadStore.getState().setThreads(cachedThreads);
    // Best-effort revert of the local DB label changes
    await Promise.all([
      removeThreadLabelInDb(threadId, account.id, "TRASH").catch((dbErr) => {
        console.error("trashThread revert: failed to remove TRASH label in DB:", dbErr);
      }),
      addThreadLabelInDb(threadId, account.id, "INBOX").catch((dbErr) => {
        console.error("trashThread revert: failed to restore INBOX label in DB:", dbErr);
      }),
    ]);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

/**
 * Run async tasks with a bounded concurrency limit. Prevents unbounded
 * `Promise.all` fan-out from exhausting Gmail API quota or contending on
 * the local SQLite writer when the user selects many threads at once.
 */
async function parallelLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit = 5,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      const task = tasks[index];
      if (!task) return;
      results[index] = await task();
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/**
 * Archive multiple threads. Optimistic UI removes all from list.
 * Reverts the removal if the API/DB calls fail.
 */
export async function archiveThreads(
  account: Account,
  threadIds: string[],
): Promise<void> {
  const cachedThreads = useThreadStore.getState().threads;
  useThreadStore.getState().removeThreads(threadIds);

  try {
    await parallelLimit(
      threadIds.map((threadId) => async () => {
        await Promise.all([
          modifyThreadLabels(account, threadId, [], ["INBOX"]),
          removeThreadLabelInDb(threadId, account.id, "INBOX"),
        ]);
      }),
    );
  } catch (err) {
    console.error("archiveThreads failed, reverting optimistic removal:", err);
    useThreadStore.getState().setThreads(cachedThreads);
    await parallelLimit(
      threadIds.map((threadId) => async () => {
        try {
          await addThreadLabelInDb(threadId, account.id, "INBOX");
        } catch (dbErr) {
          console.error(
            `archiveThreads revert: failed to restore INBOX label for ${threadId}:`,
            dbErr,
          );
        }
      }),
    );
    throw err;
  }
}

/**
 * Trash multiple threads. Optimistic UI removes all from list.
 * Reverts the removal if the API/DB calls fail.
 */
export async function trashThreads(
  account: Account,
  threadIds: string[],
): Promise<void> {
  const cachedThreads = useThreadStore.getState().threads;
  useThreadStore.getState().removeThreads(threadIds);

  try {
    await parallelLimit(
      threadIds.map((threadId) => async () => {
        await Promise.all([
          modifyThreadLabels(account, threadId, ["TRASH"], ["INBOX"]),
          addThreadLabelInDb(threadId, account.id, "TRASH"),
          removeThreadLabelInDb(threadId, account.id, "INBOX"),
        ]);
      }),
    );
  } catch (err) {
    console.error("trashThreads failed, reverting optimistic removal:", err);
    useThreadStore.getState().setThreads(cachedThreads);
    await parallelLimit(
      threadIds.map((threadId) => async () => {
        await Promise.all([
          removeThreadLabelInDb(threadId, account.id, "TRASH").catch(
            (dbErr) => {
              console.error(
                `trashThreads revert: failed to remove TRASH label for ${threadId}:`,
                dbErr,
              );
            },
          ),
          addThreadLabelInDb(threadId, account.id, "INBOX").catch((dbErr) => {
            console.error(
              `trashThreads revert: failed to restore INBOX label for ${threadId}:`,
              dbErr,
            );
          }),
        ]);
      }),
    );
    throw err;
  }
}

/**
 * Mark multiple threads as read. Optimistic UI update, then Gmail API + local DB.
 */
export async function markThreadsAsRead(
  account: Account,
  threadIds: string[],
): Promise<void> {
  useThreadStore.getState().updateThreads(threadIds, { is_read: true });

  await parallelLimit(
    threadIds.map((threadId) => async () => {
      await Promise.all([
        modifyThreadLabels(account, threadId, [], ["UNREAD"]),
        updateThreadInDb(threadId, account.id, { is_read: true }),
      ]);
    }),
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

  await parallelLimit(
    threadIds.map((threadId) => async () => {
      await Promise.all([
        modifyThreadLabels(account, threadId, ["UNREAD"], []),
        updateThreadInDb(threadId, account.id, { is_read: false }),
      ]);
    }),
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

  await parallelLimit(
    threadIds.map((threadId) => async () => {
      await Promise.all([
        modifyThreadLabels(account, threadId, ["STARRED"], []),
        updateThreadInDb(threadId, account.id, { is_starred: true }),
      ]);
    }),
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

  await parallelLimit(
    threadIds.map((threadId) => async () => {
      await Promise.all([
        modifyThreadLabels(account, threadId, [], ["STARRED"]),
        updateThreadInDb(threadId, account.id, { is_starred: false }),
      ]);
    }),
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
  const cachedThreads = useThreadStore.getState().threads;
  useThreadStore.getState().updateThread(threadId, { is_muted: true });
  useThreadStore.getState().removeThread(threadId);

  try {
    await Promise.all([
      modifyThreadLabels(account, threadId, [], ["INBOX"]),
      updateThreadInDb(threadId, account.id, { is_muted: true }),
      removeThreadLabelInDb(threadId, account.id, "INBOX"),
    ]);
  } catch (err) {
    console.error("muteThread failed, reverting optimistic removal:", err);
    useThreadStore.getState().setThreads(cachedThreads);
    await Promise.all([
      updateThreadInDb(threadId, account.id, { is_muted: false }).catch((dbErr) => {
        console.error("muteThread revert: failed to reset is_muted in DB:", dbErr);
      }),
      addThreadLabelInDb(threadId, account.id, "INBOX").catch((dbErr) => {
        console.error("muteThread revert: failed to restore INBOX label in DB:", dbErr);
      }),
    ]);
    throw err;
  }
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
