import { getDb } from "./connection";
import type { Signature } from "../../types";

export async function getAllSignatures(accountId: string): Promise<Signature[]> {
  const db = await getDb();
  return db.select<Signature[]>(
    "SELECT * FROM signatures WHERE account_id = $1 OR account_id IS NULL ORDER BY is_default DESC, created_at DESC",
    [accountId],
  );
}

export async function getSignature(id: string): Promise<Signature | null> {
  const db = await getDb();
  const rows = await db.select<Signature[]>(
    "SELECT * FROM signatures WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export async function getDefaultSignature(accountId: string): Promise<Signature | null> {
  const db = await getDb();
  const rows = await db.select<Signature[]>(
    "SELECT * FROM signatures WHERE (account_id = $1 OR account_id IS NULL) AND is_default = 1 ORDER BY account_id DESC LIMIT 1",
    [accountId],
  );
  return rows[0] ?? null;
}

export async function createSignature(signature: {
  id: string;
  account_id: string | null;
  name: string;
  body: string;
  is_default?: number;
}): Promise<void> {
  const db = await getDb();

  // If setting as default, clear other defaults for this account
  if (signature.is_default) {
    await db.execute(
      "UPDATE signatures SET is_default = 0 WHERE account_id = $1 OR (account_id IS NULL AND $1 IS NULL)",
      [signature.account_id],
    );
  }

  await db.execute(
    "INSERT INTO signatures (id, account_id, name, body, is_default) VALUES ($1, $2, $3, $4, $5)",
    [signature.id, signature.account_id, signature.name, signature.body, signature.is_default ?? 0],
  );
}

export async function updateSignature(
  id: string,
  updates: { name?: string; body?: string; is_default?: number },
  accountId?: string | null,
): Promise<void> {
  const db = await getDb();

  // If setting as default, clear other defaults for this account
  if (updates.is_default === 1 && accountId !== undefined) {
    await db.execute(
      "UPDATE signatures SET is_default = 0 WHERE account_id = $1 OR (account_id IS NULL AND $1 IS NULL)",
      [accountId],
    );
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    values.push(updates.name);
    paramIndex++;
  }
  if (updates.body !== undefined) {
    setClauses.push(`body = $${paramIndex}`);
    values.push(updates.body);
    paramIndex++;
  }
  if (updates.is_default !== undefined) {
    setClauses.push(`is_default = $${paramIndex}`);
    values.push(updates.is_default);
    paramIndex++;
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await db.execute(
    `UPDATE signatures SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
    values,
  );
}

export async function deleteSignature(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM signatures WHERE id = $1", [id]);
}
