import { fetch } from "@tauri-apps/plugin-http";
import { getDb } from "../db/connection";
import type { Account, Message } from "../../types";

export interface UnsubscribeInfo {
  canUnsubscribe: boolean;
  method: "one-click" | "mailto" | null;
  target: string | null;
}

/**
 * Parse the List-Unsubscribe header value into an array of URLs/mailto links.
 * The header format is a comma-separated list of angle-bracket-delimited URIs.
 * Example: `<https://example.com/unsub>, <mailto:unsub@example.com>`
 */
export function parseUnsubscribeHeaders(message: Message): {
  httpUrls: string[];
  mailtoUrls: string[];
  hasOneClick: boolean;
} {
  const header = message.list_unsubscribe;
  if (!header) {
    return { httpUrls: [], mailtoUrls: [], hasOneClick: false };
  }

  const httpUrls: string[] = [];
  const mailtoUrls: string[] = [];

  // Extract all angle-bracket-delimited URIs
  const matches = header.match(/<[^>]+>/g);
  if (matches) {
    for (const match of matches) {
      const uri = match.slice(1, -1).trim();
      if (uri.startsWith("https://") || uri.startsWith("http://")) {
        httpUrls.push(uri);
      } else if (uri.startsWith("mailto:")) {
        mailtoUrls.push(uri);
      }
    }
  }

  // RFC 8058: one-click unsubscribe requires both List-Unsubscribe with an
  // HTTPS URL and a List-Unsubscribe-Post header with value
  // "List-Unsubscribe=One-Click".
  const postHeader = message.list_unsubscribe_post?.trim() ?? "";
  const hasOneClick =
    httpUrls.length > 0 &&
    postHeader.toLowerCase() === "list-unsubscribe=one-click";

  return { httpUrls, mailtoUrls, hasOneClick };
}

/**
 * Determine whether and how we can unsubscribe from this message's mailing list.
 */
export function getUnsubscribeInfo(message: Message): UnsubscribeInfo {
  const { httpUrls, mailtoUrls, hasOneClick } =
    parseUnsubscribeHeaders(message);

  if (hasOneClick && httpUrls[0]) {
    return { canUnsubscribe: true, method: "one-click", target: httpUrls[0] };
  }

  if (mailtoUrls[0]) {
    return { canUnsubscribe: true, method: "mailto", target: mailtoUrls[0] };
  }

  // Fall back to any HTTP URL (not one-click, but might work as a web page)
  if (httpUrls[0]) {
    return { canUnsubscribe: true, method: "one-click", target: httpUrls[0] };
  }

  return { canUnsubscribe: false, method: null, target: null };
}

/**
 * Record an unsubscribe action in the database.
 */
async function recordUnsubscribeAction(
  messageId: string,
  accountId: string,
  method: string,
  target: string,
  status: "pending" | "success" | "failed",
): Promise<void> {
  const db = await getDb();
  const id = `unsub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.execute(
    `INSERT INTO unsubscribe_actions (id, message_id, account_id, method, target, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, messageId, accountId, method, target, status],
  );
}

/**
 * Perform one-click unsubscribe per RFC 8058:
 * POST to the List-Unsubscribe URL with body "List-Unsubscribe=One-Click".
 *
 * Falls back to mailto: if no HTTP URL is available.
 */
export async function unsubscribe(
  account: Account,
  message: Message,
): Promise<{ success: boolean; method: string; error?: string }> {
  const info = getUnsubscribeInfo(message);

  if (!info.canUnsubscribe || !info.target || !info.method) {
    return { success: false, method: "none", error: "No unsubscribe method available" };
  }

  if (info.method === "one-click") {
    try {
      await recordUnsubscribeAction(
        message.id,
        account.id,
        "one-click",
        info.target,
        "pending",
      );

      const response = await fetch(info.target, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "List-Unsubscribe=One-Click",
      });

      const status = response.ok ? "success" : "failed";
      await recordUnsubscribeAction(
        message.id,
        account.id,
        "one-click",
        info.target,
        status,
      );

      if (!response.ok) {
        return {
          success: false,
          method: "one-click",
          error: `Server returned ${response.status}`,
        };
      }

      return { success: true, method: "one-click" };
    } catch (err) {
      await recordUnsubscribeAction(
        message.id,
        account.id,
        "one-click",
        info.target,
        "failed",
      );
      return {
        success: false,
        method: "one-click",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // mailto: fallback — open the default mail client or send via SMTP
  // For now, record the action and open the mailto link
  try {
    await recordUnsubscribeAction(
      message.id,
      account.id,
      "mailto",
      info.target,
      "pending",
    );

    // Use Tauri's opener plugin to handle the mailto: link
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(info.target);

    await recordUnsubscribeAction(
      message.id,
      account.id,
      "mailto",
      info.target,
      "success",
    );

    return { success: true, method: "mailto" };
  } catch (err) {
    await recordUnsubscribeAction(
      message.id,
      account.id,
      "mailto",
      info.target,
      "failed",
    );
    return {
      success: false,
      method: "mailto",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
