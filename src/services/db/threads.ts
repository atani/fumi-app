import { getDb } from "./connection";
import type { Thread } from "../../types";
import type { ThreadCategory } from "../ai/aiService";

export async function getThreadCategoriesForAccount(
  accountId: string,
): Promise<Record<string, ThreadCategory>> {
  const db = await getDb();
  const rows = await db.select<{ thread_id: string; category: string }[]>(
    "SELECT thread_id, category FROM thread_categories WHERE account_id = $1",
    [accountId],
  );
  const map: Record<string, ThreadCategory> = {};
  for (const row of rows) {
    map[row.thread_id] = row.category as ThreadCategory;
  }
  return map;
}

export async function getCategoryCountsForThreads(
  accountId: string,
  threadIds: string[],
): Promise<Record<string, number>> {
  if (threadIds.length === 0) return {};
  const db = await getDb();
  const placeholders = threadIds.map((_, i) => `$${i + 2}`).join(",");
  const rows = await db.select<{ category: string; cnt: number }[]>(
    `SELECT category, COUNT(*) as cnt FROM thread_categories
     WHERE account_id = $1 AND thread_id IN (${placeholders})
     GROUP BY category`,
    [accountId, ...threadIds],
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.category] = row.cnt;
  }
  return counts;
}

export async function getUncategorizedInboxThreadIds(
  accountId: string,
): Promise<{ threadId: string; fromAddress: string | null; subject: string | null }[]> {
  const db = await getDb();
  return db.select<{ threadId: string; fromAddress: string | null; subject: string | null }[]>(
    `SELECT t.id AS threadId, m.from_address AS fromAddress, m.subject
     FROM threads t
     JOIN thread_labels tl ON t.id = tl.thread_id AND t.account_id = tl.account_id
     LEFT JOIN thread_categories tc ON t.id = tc.thread_id AND t.account_id = tc.account_id
     LEFT JOIN messages m ON m.thread_id = t.id AND m.account_id = t.account_id
     WHERE t.account_id = $1 AND tl.label_id = 'INBOX' AND tc.thread_id IS NULL
     GROUP BY t.id
     ORDER BY t.last_message_at DESC
     LIMIT 500`,
    [accountId],
  );
}

export async function setThreadCategory(
  threadId: string,
  accountId: string,
  category: ThreadCategory,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO thread_categories (thread_id, account_id, category) VALUES ($1, $2, $3) ON CONFLICT(thread_id, account_id) DO UPDATE SET category = $3",
    [threadId, accountId, category],
  );
}

export async function getThreadsByLabel(
  accountId: string,
  labelId: string,
): Promise<Thread[]> {
  const db = await getDb();
  return db.select<Thread[]>(
    `SELECT t.* FROM threads t
     JOIN thread_labels tl ON t.id = tl.thread_id AND t.account_id = tl.account_id
     WHERE t.account_id = $1 AND tl.label_id = $2
     ORDER BY t.last_message_at DESC
     LIMIT 500`,
    [accountId, labelId],
  );
}

const THREAD_COLUMNS = 8;
const THREAD_BATCH_ROWS = 100; // 100*8 = 800 params

function threadBindValues(thread: Thread): unknown[] {
  return [
    thread.id,
    thread.account_id,
    thread.snippet,
    thread.subject,
    thread.last_message_at,
    thread.message_count,
    thread.is_read ? 1 : 0,
    thread.is_starred ? 1 : 0,
  ];
}

const THREAD_UPSERT_ON_CONFLICT = `ON CONFLICT(id, account_id) DO UPDATE SET
       snippet = excluded.snippet,
       subject = excluded.subject,
       last_message_at = excluded.last_message_at,
       message_count = excluded.message_count,
       is_read = excluded.is_read,
       is_starred = excluded.is_starred`;

export async function upsertThread(thread: Thread): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO threads (id, account_id, snippet, subject, last_message_at, message_count, is_read, is_starred)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ${THREAD_UPSERT_ON_CONFLICT}`,
    threadBindValues(thread),
  );
}

/**
 * Upsert many threads in a single transaction using multi-row INSERTs.
 * Chunks into batches to stay below SQLite's bind-parameter limit.
 */
export async function upsertThreadsBatch(threads: Thread[]): Promise<void> {
  if (threads.length === 0) return;
  const db = await getDb();

  await db.execute("BEGIN TRANSACTION", []);
  try {
    for (let i = 0; i < threads.length; i += THREAD_BATCH_ROWS) {
      const chunk = threads.slice(i, i + THREAD_BATCH_ROWS);
      const placeholders: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      for (const thread of chunk) {
        const rowParams: string[] = [];
        for (let c = 0; c < THREAD_COLUMNS; c++) {
          rowParams.push(`$${idx++}`);
        }
        placeholders.push(`(${rowParams.join(", ")})`);
        params.push(...threadBindValues(thread));
      }
      await db.execute(
        `INSERT INTO threads (id, account_id, snippet, subject, last_message_at, message_count, is_read, is_starred)
         VALUES ${placeholders.join(", ")}
         ${THREAD_UPSERT_ON_CONFLICT}`,
        params,
      );
    }
    await db.execute("COMMIT", []);
  } catch (e) {
    await db.execute("ROLLBACK", []);
    throw e;
  }
}

export async function setThreadLabels(
  threadId: string,
  accountId: string,
  labelIds: string[],
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM thread_labels WHERE thread_id = $1 AND account_id = $2",
    [threadId, accountId],
  );
  const uniqueLabels = [...new Set(labelIds)];
  if (uniqueLabels.length === 0) return;

  // Batch INSERT all labels in a single statement
  const placeholders: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  for (const labelId of uniqueLabels) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
    params.push(threadId, labelId, accountId);
    idx += 3;
  }
  await db.execute(
    `INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ${placeholders.join(", ")}`,
    params,
  );
}

/**
 * Batch set labels for multiple threads in fewer DB round-trips.
 * Each entry maps a threadId to its labelIds.
 * Runs all operations within a single transaction.
 */
export async function setThreadLabelsBatch(
  accountId: string,
  threadLabels: { threadId: string; labelIds: string[] }[],
): Promise<void> {
  if (threadLabels.length === 0) return;

  const db = await getDb();
  await db.execute("BEGIN TRANSACTION", []);
  try {
    // Delete old labels for all threads
    const threadIds = threadLabels.map((t) => t.threadId);
    const delPlaceholders = threadIds.map((_, i) => `$${i + 2}`).join(",");
    await db.execute(
      `DELETE FROM thread_labels WHERE account_id = $1 AND thread_id IN (${delPlaceholders})`,
      [accountId, ...threadIds],
    );

    // Build a single multi-row INSERT for all thread-label pairs
    const insertPlaceholders: string[] = [];
    const insertParams: unknown[] = [];
    let idx = 1;
    for (const { threadId, labelIds } of threadLabels) {
      const uniqueLabels = [...new Set(labelIds)];
      for (const labelId of uniqueLabels) {
        insertPlaceholders.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
        insertParams.push(threadId, labelId, accountId);
        idx += 3;
      }
    }

    if (insertPlaceholders.length > 0) {
      await db.execute(
        `INSERT OR IGNORE INTO thread_labels (thread_id, label_id, account_id) VALUES ${insertPlaceholders.join(", ")}`,
        insertParams,
      );
    }

    await db.execute("COMMIT", []);
  } catch (e) {
    await db.execute("ROLLBACK", []);
    throw e;
  }
}
