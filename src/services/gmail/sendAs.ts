import type { Account, SendAsAlias } from "../../types";
import { authenticatedFetch } from "./api";
import { getDb } from "../db/connection";

interface GmailSendAs {
  sendAsEmail: string;
  displayName?: string;
  isDefault?: boolean;
  isPrimary?: boolean;
}

interface GmailSendAsResponse {
  sendAs: GmailSendAs[];
}

/**
 * Fetch send-as aliases from the Gmail API and persist them to the local DB.
 * Only works for gmail_api accounts.
 */
export async function fetchSendAsAliases(account: Account): Promise<SendAsAlias[]> {
  if (account.provider !== "gmail_api") return [];

  const response = await authenticatedFetch<GmailSendAsResponse>(
    account,
    "/settings/sendAs",
  );

  const aliases: SendAsAlias[] = (response.sendAs ?? []).map((sa) => ({
    email: sa.sendAsEmail,
    account_id: account.id,
    display_name: sa.displayName ?? "",
    is_default: sa.isDefault === true,
    is_primary: sa.isPrimary === true,
  }));

  // Persist to DB — replace all aliases for this account
  const db = await getDb();
  await db.execute("DELETE FROM send_as_aliases WHERE account_id = $1", [account.id]);
  for (const alias of aliases) {
    await db.execute(
      `INSERT INTO send_as_aliases (email, account_id, display_name, is_default, is_primary)
       VALUES ($1, $2, $3, $4, $5)`,
      [alias.email, alias.account_id, alias.display_name, alias.is_default ? 1 : 0, alias.is_primary ? 1 : 0],
    );
  }

  return aliases;
}

/**
 * Load send-as aliases from the local DB for a given account.
 */
export async function getSendAsAliases(accountId: string): Promise<SendAsAlias[]> {
  const db = await getDb();
  const rows = await db.select<
    { email: string; account_id: string; display_name: string; is_default: number; is_primary: number }[]
  >(
    "SELECT email, account_id, display_name, is_default, is_primary FROM send_as_aliases WHERE account_id = $1 ORDER BY is_primary DESC, is_default DESC, email ASC",
    [accountId],
  );

  return rows.map((row) => ({
    email: row.email,
    account_id: row.account_id,
    display_name: row.display_name,
    is_default: row.is_default === 1,
    is_primary: row.is_primary === 1,
  }));
}
