import { getDb } from "../db/connection";
import type { Contact, Message } from "../../types";

/**
 * Parse a raw address string like `"John Doe" <john@example.com>` or `john@example.com`
 * into { email, name } pairs.
 */
function parseAddressList(
  raw: string | null,
): { email: string; name: string | null }[] {
  if (!raw) return [];

  const results: { email: string; name: string | null }[] = [];

  // Split on commas that are outside angle brackets
  const parts = raw.split(/,(?=(?:[^<]*<[^>]*>)*[^>]*$)/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(?:"?(.+?)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?$/);
    if (match) {
      const name = match[1]?.trim() || null;
      const email = match[2]!.trim().toLowerCase();
      results.push({ email, name });
    }
  }

  return results;
}

/**
 * Upsert a contact: if it already exists for this account, increment frequency
 * and update the name (if provided) and last_contacted_at.
 */
export async function recordContact(
  accountId: string,
  email: string,
  name: string | null,
): Promise<void> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  await db.execute(
    `INSERT INTO contacts (email, name, frequency, account_id)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT(email, account_id) DO UPDATE SET
       frequency = contacts.frequency + 1,
       name = COALESCE($2, contacts.name),
       last_contacted_at = datetime('now')`,
    [normalizedEmail, name, accountId],
  );
}

/**
 * Search contacts by email or name prefix, ordered by frequency descending.
 */
export async function searchContacts(
  accountId: string,
  query: string,
): Promise<Contact[]> {
  const db = await getDb();
  const pattern = `%${query.toLowerCase()}%`;

  return db.select<Contact[]>(
    `SELECT id, email, name, frequency, first_contacted_at, last_contacted_at, account_id
     FROM contacts
     WHERE account_id = $1
       AND (LOWER(email) LIKE $2 OR LOWER(COALESCE(name, '')) LIKE $2)
     ORDER BY frequency DESC
     LIMIT 10`,
    [accountId, pattern],
  );
}

/**
 * Extract all contacts (From, To, Cc) from a message and return them as
 * { email, name } pairs.
 */
export function extractContactsFromMessage(
  message: Message,
): { email: string; name: string | null }[] {
  const contacts: { email: string; name: string | null }[] = [];

  // From
  if (message.from_address) {
    contacts.push({
      email: message.from_address.toLowerCase(),
      name: message.from_name,
    });
  }

  // To, Cc, Bcc
  contacts.push(...parseAddressList(message.to_addresses));
  contacts.push(...parseAddressList(message.cc_addresses));
  contacts.push(...parseAddressList(message.bcc_addresses));

  return contacts;
}

/**
 * Record all contacts found in a batch of messages.
 */
export async function recordContactsFromMessages(
  accountId: string,
  messages: Message[],
): Promise<void> {
  for (const message of messages) {
    const contacts = extractContactsFromMessage(message);
    for (const { email, name } of contacts) {
      await recordContact(accountId, email, name);
    }
  }
}
