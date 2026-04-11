import { getDb } from "./connection";
import type { Message } from "../../types";

export async function getMessagesByThread(
  accountId: string,
  threadId: string,
): Promise<Message[]> {
  const db = await getDb();
  return db.select<Message[]>(
    "SELECT * FROM messages WHERE account_id = $1 AND thread_id = $2 ORDER BY date ASC",
    [accountId, threadId],
  );
}

export async function upsertMessage(message: Message): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO messages (id, thread_id, account_id, from_address, from_name, to_addresses, cc_addresses, bcc_addresses, subject, snippet, body_html, body_text, date, is_read, has_attachments, header_message_id, list_unsubscribe, list_unsubscribe_post, imap_uid, imap_folder, message_id_header, references_header, in_reply_to_header)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
     ON CONFLICT(id, account_id) DO UPDATE SET
       from_address = excluded.from_address,
       from_name = excluded.from_name,
       to_addresses = excluded.to_addresses,
       subject = excluded.subject,
       snippet = excluded.snippet,
       body_html = excluded.body_html,
       body_text = excluded.body_text,
       is_read = excluded.is_read,
       has_attachments = excluded.has_attachments,
       list_unsubscribe = excluded.list_unsubscribe,
       list_unsubscribe_post = excluded.list_unsubscribe_post,
       imap_uid = excluded.imap_uid,
       imap_folder = excluded.imap_folder,
       message_id_header = excluded.message_id_header,
       references_header = excluded.references_header,
       in_reply_to_header = excluded.in_reply_to_header`,
    [
      message.id,
      message.thread_id,
      message.account_id,
      message.from_address,
      message.from_name,
      message.to_addresses,
      message.cc_addresses,
      message.bcc_addresses,
      message.subject,
      message.snippet,
      message.body_html,
      message.body_text,
      message.date,
      message.is_read ? 1 : 0,
      message.has_attachments ? 1 : 0,
      message.header_message_id,
      message.list_unsubscribe ?? null,
      message.list_unsubscribe_post ?? null,
      message.imap_uid ?? null,
      message.imap_folder ?? null,
      message.message_id_header ?? null,
      message.references_header ?? null,
      message.in_reply_to_header ?? null,
    ],
  );
}
