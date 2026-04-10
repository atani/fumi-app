import { getDb } from "./connection";
import type { Account } from "../../types";

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

export async function upsertAccount(account: Account): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO accounts (id, email, name, picture, provider, access_token, refresh_token, token_expiry)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       picture = excluded.picture,
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_expiry = excluded.token_expiry,
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
