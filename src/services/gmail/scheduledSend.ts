import type { Account } from "../../types";
import type { SendEmailOptions } from "./send";
import { sendEmail } from "./send";

export interface ScheduledSend {
  cancel: () => void;
  /** Resolves when the email is actually sent, rejects if cancelled or failed. */
  promise: Promise<void>;
}

/**
 * Schedule an email to be sent after a delay. Returns a cancel function
 * and a promise that resolves/rejects based on send outcome.
 *
 * @param account - The account to send from
 * @param options - Email options (to, cc, bcc, subject, body, etc.)
 * @param delayMs - Milliseconds to wait before sending
 * @returns Object with `cancel()` to abort and `promise` for the send result
 */
export function scheduleSend(
  account: Account,
  options: SendEmailOptions,
  delayMs: number,
): ScheduledSend {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rejectFn: ((reason: Error) => void) | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    rejectFn = reject;

    timer = setTimeout(async () => {
      if (cancelled) {
        reject(new Error("Send cancelled"));
        return;
      }
      try {
        await sendEmail(account, options);
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to send email"));
      }
    }, delayMs);
  });

  const cancel = () => {
    cancelled = true;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    rejectFn?.(new Error("Send cancelled"));
  };

  return { cancel, promise };
}
