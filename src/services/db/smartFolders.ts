import { getDb } from "./connection";
import type { SmartFolder } from "../../types";

export async function getSmartFoldersByAccount(
  accountId: string,
): Promise<SmartFolder[]> {
  const db = await getDb();
  return db.select<SmartFolder[]>(
    "SELECT * FROM smart_folders WHERE account_id = $1 ORDER BY sort_order ASC, created_at ASC",
    [accountId],
  );
}

export async function insertSmartFolder(folder: SmartFolder): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO smart_folders (id, account_id, name, query, icon, sort_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      folder.id,
      folder.account_id,
      folder.name,
      folder.query,
      folder.icon,
      folder.sort_order,
      folder.created_at,
    ],
  );
}

export async function updateSmartFolderInDb(
  id: string,
  accountId: string,
  updates: Partial<Pick<SmartFolder, "name" | "query" | "icon" | "sort_order">>,
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${String(paramIdx)}`);
    values.push(updates.name);
    paramIdx++;
  }
  if (updates.query !== undefined) {
    setClauses.push(`query = $${String(paramIdx)}`);
    values.push(updates.query);
    paramIdx++;
  }
  if (updates.icon !== undefined) {
    setClauses.push(`icon = $${String(paramIdx)}`);
    values.push(updates.icon);
    paramIdx++;
  }
  if (updates.sort_order !== undefined) {
    setClauses.push(`sort_order = $${String(paramIdx)}`);
    values.push(updates.sort_order);
    paramIdx++;
  }

  if (setClauses.length === 0) return;

  values.push(id, accountId);
  await db.execute(
    `UPDATE smart_folders SET ${setClauses.join(", ")} WHERE id = $${String(paramIdx)} AND account_id = $${String(paramIdx + 1)}`,
    values,
  );
}

export async function deleteSmartFolderFromDb(
  id: string,
  accountId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM smart_folders WHERE id = $1 AND account_id = $2",
    [id, accountId],
  );
}
