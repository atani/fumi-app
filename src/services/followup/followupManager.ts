import { getDb } from "../db/connection";
import type { Account, FollowUpReminder, Message } from "../../types";

/**
 * Add a follow-up reminder for a thread.
 * If one already exists for this thread+account, it is replaced.
 */
export async function addFollowUp(
  threadId: string,
  accountId: string,
  hours: number,
): Promise<void> {
  const db = await getDb();
  const id = `followup-${threadId}-${accountId}`;

  await db.execute(
    `INSERT INTO follow_up_reminders (id, thread_id, account_id, remind_after_hours)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       remind_after_hours = excluded.remind_after_hours,
       reminded_at = NULL,
       created_at = datetime('now')`,
    [id, threadId, accountId, hours],
  );
}

/**
 * Remove a follow-up reminder for a thread.
 */
export async function removeFollowUp(
  threadId: string,
  accountId: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM follow_up_reminders WHERE thread_id = $1 AND account_id = $2",
    [threadId, accountId],
  );
}

/**
 * Get the active follow-up reminder for a thread, if any.
 */
export async function getFollowUp(
  threadId: string,
  accountId: string,
): Promise<FollowUpReminder | null> {
  const db = await getDb();
  const rows = await db.select<FollowUpReminder[]>(
    `SELECT * FROM follow_up_reminders
     WHERE thread_id = $1 AND account_id = $2 AND reminded_at IS NULL
     LIMIT 1`,
    [threadId, accountId],
  );
  return rows[0] ?? null;
}

interface FollowUpCandidate {
  reminder: FollowUpReminder;
  subject: string;
}

/**
 * Check all pending follow-up reminders for an account.
 * Returns threads that need a follow-up notification (sent message with no
 * reply after the configured number of hours).
 */
export async function checkFollowUps(
  account: Account,
): Promise<FollowUpCandidate[]> {
  const db = await getDb();

  const reminders = await db.select<FollowUpReminder[]>(
    `SELECT * FROM follow_up_reminders
     WHERE account_id = $1 AND reminded_at IS NULL`,
    [account.id],
  );

  if (reminders.length === 0) return [];

  const fired: FollowUpCandidate[] = [];
  const now = new Date();

  for (const reminder of reminders) {
    // Get all messages in the thread ordered by date
    const messages = await db.select<Message[]>(
      `SELECT * FROM messages
       WHERE thread_id = $1 AND account_id = $2
       ORDER BY date ASC`,
      [reminder.thread_id, account.id],
    );

    if (messages.length === 0) continue;

    // Find the last message sent by the account owner
    let lastSentIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.from_address?.toLowerCase() === account.email.toLowerCase()) {
        lastSentIdx = i;
        break;
      }
    }

    // No sent message found — nothing to follow up on
    if (lastSentIdx === -1) continue;

    const lastSentMessage = messages[lastSentIdx]!;

    // Check if there's any reply after the sent message (from someone else)
    const hasReply = messages.slice(lastSentIdx + 1).some(
      (m) => m.from_address?.toLowerCase() !== account.email.toLowerCase(),
    );

    if (hasReply) {
      // Got a reply — auto-clear the reminder
      await db.execute(
        `UPDATE follow_up_reminders SET reminded_at = datetime('now')
         WHERE id = $1`,
        [reminder.id],
      );
      continue;
    }

    // Check if enough time has elapsed
    if (!lastSentMessage.date) continue;
    const sentAt = new Date(lastSentMessage.date);
    const elapsedHours = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);

    if (elapsedHours >= reminder.remind_after_hours) {
      // Mark as reminded
      await db.execute(
        `UPDATE follow_up_reminders SET reminded_at = datetime('now')
         WHERE id = $1`,
        [reminder.id],
      );

      const subject =
        lastSentMessage.subject ?? "(No subject)";
      fired.push({ reminder, subject });
    }
  }

  return fired;
}
