import { getDb } from "./connection";
import type { Label } from "../../types";

export async function getLabelsByAccount(accountId: string): Promise<Label[]> {
  const db = await getDb();
  return db.select<Label[]>(
    "SELECT * FROM labels WHERE account_id = $1 ORDER BY type, name",
    [accountId],
  );
}

export async function upsertLabel(label: Label): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO labels (id, account_id, name, type, color)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id, account_id) DO UPDATE SET
       name = excluded.name,
       color = excluded.color`,
    [label.id, label.account_id, label.name, label.type, label.color],
  );
}

export async function deleteLabelFromDb(
  labelId: string,
  accountId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM thread_labels WHERE label_id = $1 AND account_id = $2",
    [labelId, accountId],
  );
  await db.execute(
    "DELETE FROM labels WHERE id = $1 AND account_id = $2",
    [labelId, accountId],
  );
}

export async function getThreadLabelIds(
  threadId: string,
  accountId: string,
): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ label_id: string }[]>(
    "SELECT label_id FROM thread_labels WHERE thread_id = $1 AND account_id = $2",
    [threadId, accountId],
  );
  return rows.map((r) => r.label_id);
}

/**
 * Batch fetch label IDs for multiple threads in a single query.
 * Returns a map of threadId -> labelId[].
 */
export async function getThreadLabelIdsForThreads(
  accountId: string,
  threadIds: string[],
): Promise<Record<string, string[]>> {
  if (threadIds.length === 0) return {};

  const db = await getDb();
  const placeholders = threadIds.map((_, i) => `$${i + 2}`).join(",");
  const rows = await db.select<{ thread_id: string; label_id: string }[]>(
    `SELECT thread_id, label_id FROM thread_labels WHERE account_id = $1 AND thread_id IN (${placeholders})`,
    [accountId, ...threadIds],
  );

  const result: Record<string, string[]> = {};
  for (const id of threadIds) {
    result[id] = [];
  }
  for (const row of rows) {
    result[row.thread_id]?.push(row.label_id);
  }
  return result;
}
