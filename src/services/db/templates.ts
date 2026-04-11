import { getDb } from "./connection";
import type { Template } from "../../types";

export async function getAllTemplates(accountId: string): Promise<Template[]> {
  const db = await getDb();
  return db.select<Template[]>(
    "SELECT * FROM templates WHERE account_id = $1 OR account_id IS NULL ORDER BY created_at DESC",
    [accountId],
  );
}

export async function getTemplate(id: string): Promise<Template | null> {
  const db = await getDb();
  const rows = await db.select<Template[]>(
    "SELECT * FROM templates WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createTemplate(template: {
  id: string;
  account_id: string | null;
  name: string;
  subject: string | null;
  body: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO templates (id, account_id, name, subject, body) VALUES ($1, $2, $3, $4, $5)",
    [template.id, template.account_id, template.name, template.subject, template.body],
  );
}

export async function updateTemplate(
  id: string,
  updates: { name?: string; subject?: string | null; body?: string | null },
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    values.push(updates.name);
    paramIndex++;
  }
  if (updates.subject !== undefined) {
    setClauses.push(`subject = $${paramIndex}`);
    values.push(updates.subject);
    paramIndex++;
  }
  if (updates.body !== undefined) {
    setClauses.push(`body = $${paramIndex}`);
    values.push(updates.body);
    paramIndex++;
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await db.execute(
    `UPDATE templates SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
    values,
  );
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM templates WHERE id = $1", [id]);
}
