import type { Account } from "../../types";
import { refreshAccessToken, getClientId } from "./auth";
import { updateTokens } from "../db/accounts";
import { useAccountStore } from "../../stores/accountStore";
import { getDb } from "../db/connection";

/** Buffer in milliseconds before actual expiry to trigger a refresh (5 minutes). */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** In-flight refresh promises keyed by account ID to avoid duplicate refreshes. */
const pendingRefreshes = new Map<string, Promise<string>>();

async function getClientSecret(): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'google_client_secret'",
  );
  return rows[0]?.value ?? null;
}

function isTokenExpiringSoon(account: Account): boolean {
  if (!account.token_expiry) return true;
  // token_expiry may be stored as epoch ms (from LoginPage) or epoch seconds (from doRefresh)
  // If value > 1e12 it's milliseconds, otherwise seconds
  const expiryMs =
    account.token_expiry > 1e12
      ? account.token_expiry
      : account.token_expiry * 1000;
  return Date.now() >= expiryMs - REFRESH_BUFFER_MS;
}

async function doRefresh(account: Account): Promise<string> {
  if (!account.refresh_token) {
    throw new Error(`No refresh token for account ${account.id}`);
  }

  const clientId = await getClientId();
  if (!clientId) {
    throw new Error("Google client ID not configured");
  }
  const clientSecret = await getClientSecret();

  const tokenResponse = await refreshAccessToken(
    clientId,
    account.refresh_token,
    clientSecret ?? undefined,
  );

  const newExpiry = Math.floor(Date.now() / 1000) + tokenResponse.expires_in;

  // Persist to DB
  await updateTokens(
    account.id,
    tokenResponse.access_token,
    tokenResponse.refresh_token ?? null,
    newExpiry,
  );

  // Update in-memory store so other callers see the fresh token immediately
  const store = useAccountStore.getState();
  const updatedAccounts = store.accounts.map((a) =>
    a.id === account.id
      ? {
          ...a,
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token ?? a.refresh_token,
          token_expiry: newExpiry,
        }
      : a,
  );
  useAccountStore.setState({ accounts: updatedAccounts });

  return tokenResponse.access_token;
}

/**
 * Returns a valid access token for the given account.
 * If the token is expired or about to expire (within 5 minutes),
 * it refreshes the token, updates the DB and store, then returns the new token.
 * Concurrent calls for the same account share a single refresh request.
 */
export async function getValidAccessToken(account: Account): Promise<string> {
  if (account.access_token && !isTokenExpiringSoon(account)) {
    return account.access_token;
  }

  // Deduplicate concurrent refresh attempts for the same account
  const existing = pendingRefreshes.get(account.id);
  if (existing) {
    return existing;
  }

  const refreshPromise = doRefresh(account).finally(() => {
    pendingRefreshes.delete(account.id);
  });
  pendingRefreshes.set(account.id, refreshPromise);
  return refreshPromise;
}

/**
 * Wraps a Gmail API call with automatic token refresh on 401.
 * On a 401 response, refreshes the token and retries the call once.
 */
export async function withTokenRefresh<T>(
  account: Account,
  apiCall: (accessToken: string) => Promise<T>,
): Promise<T> {
  const token = await getValidAccessToken(account);
  try {
    return await apiCall(token);
  } catch (error) {
    // Retry once on 401
    if (error instanceof Error && error.message.includes("(401)")) {
      // Force a fresh refresh by treating the current token as expired
      const freshToken = await doRefresh(account);
      return apiCall(freshToken);
    }
    throw error;
  }
}
