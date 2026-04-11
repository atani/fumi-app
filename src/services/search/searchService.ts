import { getDb } from "../db/connection";
import { authenticatedFetch } from "../gmail/api";
import type { Account, Thread } from "../../types";

interface GmailSearchResponse {
  messages?: { id: string; threadId: string }[];
  resultSizeEstimate?: number;
}

/**
 * Search messages locally via FTS5, returning matching threads.
 */
export async function searchLocal(
  accountId: string,
  query: string,
): Promise<Thread[]> {
  const db = await getDb();

  // FTS5 match query — escape double-quotes in user input
  const sanitized = query.replace(/"/g, '""');

  return db.select<Thread[]>(
    `SELECT DISTINCT t.*
     FROM messages_fts fts
     JOIN messages m ON m.rowid = fts.rowid
     JOIN threads t ON t.id = m.thread_id AND t.account_id = m.account_id
     WHERE fts.messages_fts MATCH $1
       AND m.account_id = $2
     ORDER BY t.last_message_at DESC
     LIMIT 50`,
    [`"${sanitized}"`, accountId],
  );
}

/**
 * Search via Gmail API, returning thread IDs found server-side.
 */
export async function searchGmail(
  account: Account,
  query: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: "20",
  });

  const response = await authenticatedFetch<GmailSearchResponse>(
    account,
    `/messages?${params.toString()}`,
  );

  if (!response.messages) return [];

  // Deduplicate thread IDs
  const threadIds = [...new Set(response.messages.map((m) => m.threadId))];
  return threadIds;
}

/**
 * Combined search: try local FTS first, fall back to Gmail API for broader results.
 */
export async function search(
  account: Account,
  query: string,
): Promise<Thread[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Try local search first
  const localResults = await searchLocal(account.id, trimmed);
  if (localResults.length > 0) {
    return localResults;
  }

  // Fall back to Gmail API for results not yet synced locally
  try {
    const threadIds = await searchGmail(account, trimmed);
    if (threadIds.length === 0) return [];

    // Fetch whatever threads we have locally that match the API results
    const db = await getDb();
    const placeholders = threadIds.map((_, i) => `$${i + 2}`).join(",");
    const threads = await db.select<Thread[]>(
      `SELECT * FROM threads
       WHERE account_id = $1 AND id IN (${placeholders})
       ORDER BY last_message_at DESC`,
      [account.id, ...threadIds],
    );

    return threads;
  } catch {
    // If Gmail API fails (offline, etc.), return empty
    return [];
  }
}
