import { getDb } from "./connection";
import type { Attachment } from "../../types";

export async function getAttachmentsByMessage(
  accountId: string,
  messageId: string,
): Promise<Attachment[]> {
  const db = await getDb();
  return db.select<Attachment[]>(
    "SELECT * FROM attachments WHERE account_id = $1 AND message_id = $2",
    [accountId, messageId],
  );
}

export async function getAttachmentsByThread(
  accountId: string,
  messageIds: string[],
): Promise<Map<string, Attachment[]>> {
  if (messageIds.length === 0) return new Map();

  const db = await getDb();
  const placeholders = messageIds.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await db.select<Attachment[]>(
    `SELECT * FROM attachments WHERE account_id = $1 AND message_id IN (${placeholders})`,
    [accountId, ...messageIds],
  );

  const map = new Map<string, Attachment[]>();
  for (const row of rows) {
    const existing = map.get(row.message_id) ?? [];
    existing.push(row);
    map.set(row.message_id, existing);
  }
  return map;
}

export async function upsertAttachment(attachment: Attachment): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO attachments (id, message_id, account_id, filename, mime_type, size, content_id, cached_at, cache_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(id) DO UPDATE SET
       filename = excluded.filename,
       mime_type = excluded.mime_type,
       size = excluded.size,
       content_id = excluded.content_id`,
    [
      attachment.id,
      attachment.message_id,
      attachment.account_id,
      attachment.filename,
      attachment.mime_type,
      attachment.size,
      attachment.content_id,
      attachment.cached_at,
      attachment.cache_size,
    ],
  );
}

export async function upsertAttachments(
  attachments: Attachment[],
): Promise<void> {
  for (const attachment of attachments) {
    await upsertAttachment(attachment);
  }
}
