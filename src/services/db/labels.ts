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
