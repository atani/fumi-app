import { getAccount } from "../db/accounts";
import {
  claimScheduledEmail,
  getDueScheduledEmails,
  updateScheduledEmailStatus,
} from "../db/scheduledEmails";
import { sendEmail } from "../gmail/send";
import type { ComposerAttachment } from "../../types";

let intervalId: ReturnType<typeof setInterval> | null = null;
/** Guards against a slow run overlapping the next 60s tick (would double-send). */
let isChecking = false;

/**
 * Process any scheduled emails whose send time has arrived.
 * Looks up the account for each email, sends it, and updates the status.
 */
async function checkScheduledEmails(): Promise<void> {
  if (isChecking) return;
  isChecking = true;

  try {
    const dueEmails = await getDueScheduledEmails();

    for (const email of dueEmails) {
      // Atomically move 'pending' → 'sending'. If another run already claimed
      // this row, skip it so the same email is never sent twice.
      if (!(await claimScheduledEmail(email.id))) continue;

      try {
        const account = await getAccount(email.account_id);
        if (!account) {
          await updateScheduledEmailStatus(
            email.id,
            "failed",
            "Account not found",
          );
          continue;
        }

        let attachments: ComposerAttachment[] | undefined;
        if (email.attachments) {
          try {
            attachments = JSON.parse(email.attachments) as ComposerAttachment[];
          } catch {
            // Never silently send an email missing the user's attachments —
            // mark it failed so it surfaces instead of arriving incomplete.
            await updateScheduledEmailStatus(
              email.id,
              "failed",
              "Malformed attachment data",
            );
            continue;
          }
        }

        await sendEmail(account, {
          to: email.to_addresses,
          cc: email.cc ?? undefined,
          bcc: email.bcc ?? undefined,
          subject: email.subject,
          body: email.body,
          attachments,
        });

        await updateScheduledEmailStatus(email.id, "sent");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown send error";
        console.error(`Failed to send scheduled email ${email.id}:`, message);
        await updateScheduledEmailStatus(email.id, "failed", message);
      }
    }
  } catch (err) {
    // A DB read/claim failure must not become an unhandled rejection that
    // silently stalls the scheduler for the rest of the session.
    console.error("Scheduled send check failed:", err);
  } finally {
    isChecking = false;
  }
}

/**
 * Start a background interval that checks for due scheduled emails.
 * Runs every 60 seconds.
 */
export function startScheduledSendChecker(): void {
  stopScheduledSendChecker();
  intervalId = setInterval(() => {
    void checkScheduledEmails();
  }, 60_000);
}

/**
 * Stop the scheduled send checker interval.
 */
export function stopScheduledSendChecker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
