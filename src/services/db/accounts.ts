import { getDb } from "./connection";
import type { Account, AccountSummary } from "../../types";

const ACCOUNT_SUMMARY_COLUMNS = `id, email, name, picture, provider,
  imap_host, imap_port, imap_security, imap_username,
  smtp_host, smtp_port, smtp_security,
  created_at, updated_at`;

export async function getAllAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.select<Account[]>("SELECT * FROM accounts ORDER BY created_at");
}

export async function getAccount(id: string): Promise<Account | null> {
  const db = await getDb();
  const rows = await db.select<Account[]>(
    "SELECT * FROM accounts WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Returns all accounts without sensitive credential fields.
 * Use this for UI display, account lists, and anywhere tokens are not needed.
 */
export async function getAccountsWithoutCredentials(): Promise<
  AccountSummary[]
> {
  const db = await getDb();
  return db.select<AccountSummary[]>(
    `SELECT ${ACCOUNT_SUMMARY_COLUMNS} FROM accounts ORDER BY created_at`,
  );
}

/**
 * Returns a single account without sensitive credential fields.
 * Use this for UI display where tokens are not needed.
 */
export async function getAccountWithoutCredentials(
  id: string,
): Promise<AccountSummary | null> {
  const db = await getDb();
  const rows = await db.select<AccountSummary[]>(
    `SELECT ${ACCOUNT_SUMMARY_COLUMNS} FROM accounts WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function upsertAccount(account: Account): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO accounts (id, email, name, picture, provider, access_token, refresh_token, token_expiry,
       imap_host, imap_port, imap_security, imap_username, imap_password, smtp_host, smtp_port, smtp_security)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       picture = excluded.picture,
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_expiry = excluded.token_expiry,
       imap_host = excluded.imap_host,
       imap_port = excluded.imap_port,
       imap_security = excluded.imap_security,
       imap_username = excluded.imap_username,
       imap_password = excluded.imap_password,
       smtp_host = excluded.smtp_host,
       smtp_port = excluded.smtp_port,
       smtp_security = excluded.smtp_security,
       updated_at = datetime('now')`,
    [
      account.id,
      account.email,
      account.name,
      account.picture,
      account.provider,
      account.access_token,
      account.refresh_token,
      account.token_expiry,
      account.imap_host ?? null,
      account.imap_port ?? null,
      account.imap_security ?? null,
      account.imap_username ?? null,
      account.imap_password ?? null,
      account.smtp_host ?? null,
      account.smtp_port ?? null,
      account.smtp_security ?? null,
    ],
  );
}

export async function updateTokens(
  accountId: string,
  accessToken: string,
  refreshToken: string | null,
  expiry: number,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE accounts SET access_token = $1, refresh_token = COALESCE($2, refresh_token), token_expiry = $3, updated_at = datetime('now') WHERE id = $4`,
    [accessToken, refreshToken, expiry, accountId],
  );
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM accounts WHERE id = $1", [id]);
}
