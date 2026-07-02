import { getDb } from "./connection";
import type { ScheduledEmail } from "../../types";

export async function createScheduledEmail(email: {
  id: string;
  account_id: string;
  to_addresses: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  body: string;
  attachments: string | null;
  scheduled_at: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO scheduled_emails (id, account_id, to_addresses, cc, bcc, subject, body, attachments, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      email.id,
      email.account_id,
      email.to_addresses,
      email.cc,
      email.bcc,
      email.subject,
      email.body,
      email.attachments,
      email.scheduled_at,
    ],
  );
}

export async function getDueScheduledEmails(): Promise<ScheduledEmail[]> {
  const db = await getDb();
  return db.select<ScheduledEmail[]>(
    "SELECT * FROM scheduled_emails WHERE status = 'pending' AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC",
  );
}

export async function getPendingScheduledEmails(
  accountId: string,
): Promise<ScheduledEmail[]> {
  const db = await getDb();
  return db.select<ScheduledEmail[]>(
    "SELECT * FROM scheduled_emails WHERE account_id = $1 AND status = 'pending' ORDER BY scheduled_at ASC",
    [accountId],
  );
}

/**
 * Atomically claim a due email for sending by moving it from 'pending' to
 * 'sending'. Returns true only if THIS call transitioned the row, so two
 * overlapping checker runs can never both send the same email.
 */
export async function claimScheduledEmail(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute(
    "UPDATE scheduled_emails SET status = 'sending' WHERE id = $1 AND status = 'pending'",
    [id],
  );
  return (result?.rowsAffected ?? 0) > 0;
}

export async function updateScheduledEmailStatus(
  id: string,
  status: "sent" | "failed",
  error?: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE scheduled_emails SET status = $1, error = $2 WHERE id = $3",
    [status, error ?? null, id],
  );
}

export async function deleteScheduledEmail(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM scheduled_emails WHERE id = $1", [id]);
}
