import type { Account } from "../../types";
import { checkSnoozedThreads } from "./snoozeService";

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start a background interval that checks for snoozed threads to unsnooze.
 * Runs every 60 seconds.
 */
export function startSnoozeChecker(getAccount: () => Account | null): void {
  stopSnoozeChecker();

  intervalId = setInterval(() => {
    const account = getAccount();
    if (account) {
      void checkSnoozedThreads(account);
    }
  }, 60_000);
}

/**
 * Stop the snooze checker interval.
 */
export function stopSnoozeChecker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
