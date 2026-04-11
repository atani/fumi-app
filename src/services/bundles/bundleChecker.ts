import type { Account } from "../../types";
import { checkBundleSchedules } from "./bundleManager";

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start a background interval that checks bundle delivery schedules.
 * Runs every 60 seconds.
 */
export function startBundleChecker(getAccount: () => Account | null): void {
  stopBundleChecker();

  intervalId = setInterval(() => {
    const account = getAccount();
    if (account) {
      void checkBundleSchedules(account);
    }
  }, 60_000);
}

/**
 * Stop the bundle checker interval.
 */
export function stopBundleChecker(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
