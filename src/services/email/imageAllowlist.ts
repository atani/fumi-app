import { getDb } from "../db/connection";

function extractDomain(email: string): string | null {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return null;
  return email.slice(atIndex + 1).toLowerCase();
}

/**
 * Check whether remote images should be loaded for the given sender.
 * Returns true if the exact sender OR their domain is in the allowlist.
 */
export async function isAllowed(
  accountId: string,
  senderEmail: string,
): Promise<boolean> {
  const db = await getDb();
  const domain = extractDomain(senderEmail);
  const senderLower = senderEmail.toLowerCase();

  const rows = await db.select<{ sender: string }[]>(
    `SELECT sender FROM image_allowlist
     WHERE account_id = $1
       AND (LOWER(sender) = $2 OR (domain IS NOT NULL AND domain = $3))
     LIMIT 1`,
    [accountId, senderLower, domain ?? ""],
  );

  return rows.length > 0;
}

/**
 * Add a sender to the image allowlist. The domain is extracted and stored
 * so that future messages from the same domain are also allowed.
 */
export async function addToAllowlist(
  accountId: string,
  senderEmail: string,
): Promise<void> {
  const db = await getDb();
  const domain = extractDomain(senderEmail);

  await db.execute(
    `INSERT OR IGNORE INTO image_allowlist (sender, account_id, domain, created_at)
     VALUES ($1, $2, $3, datetime('now'))`,
    [senderEmail.toLowerCase(), accountId, domain],
  );
}

/**
 * Remove a sender from the image allowlist.
 */
export async function removeFromAllowlist(
  accountId: string,
  senderEmail: string,
): Promise<void> {
  const db = await getDb();

  await db.execute(
    `DELETE FROM image_allowlist WHERE LOWER(sender) = $1 AND account_id = $2`,
    [senderEmail.toLowerCase(), accountId],
  );
}
