import { getAccount } from "../db/accounts";
import {
  getDueScheduledEmails,
  updateScheduledEmailStatus,
} from "../db/scheduledEmails";
import { sendEmail } from "../gmail/send";
import type { ComposerAttachment } from "../../types";

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Process any scheduled emails whose send time has arrived.
 * Looks up the account for each email, sends it, and updates the status.
 */
async function checkScheduledEmails(): Promise<void> {
  const dueEmails = await getDueScheduledEmails();

  for (const email of dueEmails) {
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
          // Ignore malformed attachment data
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
