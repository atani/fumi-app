import { getDb } from "./connection";
import type { Thread } from "../../types";

export async function getThreadsByLabel(
  accountId: string,
  labelId: string,
): Promise<Thread[]> {
  const db = await getDb();
  return db.select<Thread[]>(
    `SELECT t.* FROM threads t
     JOIN thread_labels tl ON t.id = tl.thread_id AND t.account_id = tl.account_id
     WHERE t.account_id = $1 AND tl.label_id = $2
     ORDER BY t.last_message_at DESC`,
    [accountId, labelId],
  );
}

export async function upsertThread(thread: Thread): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO threads (id, account_id, snippet, subject, last_message_at, message_count, is_read, is_starred)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id, account_id) DO UPDATE SET
       snippet = excluded.snippet,
       subject = excluded.subject,
       last_message_at = excluded.last_message_at,
       message_count = excluded.message_count,
       is_read = excluded.is_read,
       is_starred = excluded.is_starred`,
    [
      thread.id,
      thread.account_id,
      thread.snippet,
      thread.subject,
      thread.last_message_at,
      thread.message_count,
      thread.is_read ? 1 : 0,
      thread.is_starred ? 1 : 0,
    ],
  );
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
  for (const labelId of labelIds) {
    await db.execute(
      "INSERT INTO thread_labels (thread_id, label_id, account_id) VALUES ($1, $2, $3)",
      [threadId, labelId, accountId],
    );
  }
}
