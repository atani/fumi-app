import type { Account } from "../../types";
import { checkFollowUps } from "./followupManager";
import { notifyFollowUp } from "../notifications/notificationManager";

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start a background interval that checks for follow-up reminders.
 * Runs every 60 seconds.
 */
export function startFollowUpChecker(getAccount: () => Account | null): void {
  stopFollowUpChecker();

  intervalId = setInterval(async () => {
    const account = getAccount();
    if (!account) return;

    const fired = await checkFollowUps(account);
    for (const { subject } of fired) {
      await notifyFollowUp(subject);
    }
  }, 60_000);
}

/**
 * Stop the follow-up checker interval.
 */
export function stopFollowUpChecker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
