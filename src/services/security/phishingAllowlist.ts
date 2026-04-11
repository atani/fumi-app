import { getDb } from "../db/connection";

/**
 * Check whether a URL or sender is in the phishing allowlist for the given account.
 */
export async function isPhishingAllowed(
  accountId: string,
  urlOrSender: string,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ url_or_sender: string }[]>(
    `SELECT url_or_sender FROM phishing_allowlist
     WHERE account_id = $1 AND LOWER(url_or_sender) = LOWER($2)
     LIMIT 1`,
    [accountId, urlOrSender],
  );
  return rows.length > 0;
}

/**
 * Add a URL or sender to the phishing allowlist. Future phishing checks
 * will skip entries that match.
 */
export async function addToPhishingAllowlist(
  accountId: string,
  urlOrSender: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO phishing_allowlist (url_or_sender, account_id, created_at)
     VALUES ($1, $2, datetime('now'))`,
    [urlOrSender.toLowerCase(), accountId],
  );
}

/**
 * Remove a URL or sender from the phishing allowlist.
 */
export async function removeFromPhishingAllowlist(
  accountId: string,
  urlOrSender: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `DELETE FROM phishing_allowlist WHERE LOWER(url_or_sender) = LOWER($1) AND account_id = $2`,
    [urlOrSender, accountId],
  );
}
