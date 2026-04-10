import type { GmailTokenResponse, GmailUserInfo } from "../../types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function getClientId(): Promise<string | null> {
  const { getDb } = await import("../db/connection");
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'google_client_id'",
  );
  return rows[0]?.value ?? null;
}

export async function startOAuthFlow(clientId: string): Promise<{
  code: string;
  codeVerifier: string;
  redirectUri: string;
}> {
  if (!isTauri()) {
    throw new Error("OAuth requires Tauri desktop environment");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const { openUrl } = await import("@tauri-apps/plugin-opener");

  const port: number = await invoke("start_oauth_server");
  const redirectUri = `http://127.0.0.1:${port}`;

  const [challenge, state]: [string, string] =
    await invoke("get_oauth_params");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  await openUrl(authUrl);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OAuth timeout after 5 minutes"));
    }, 5 * 60 * 1000);

    listen<{ code: string; state: string }>("oauth-callback", async (event) => {
      clearTimeout(timeout);
      if (event.payload.state !== state) {
        reject(new Error("OAuth state mismatch"));
        return;
      }
      const codeVerifier: string = await invoke("get_code_verifier");
      resolve({
        code: event.payload.code,
        codeVerifier,
        redirectUri,
      });
    });
  });
}

export async function exchangeCodeForTokens(
  clientId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<GmailTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
): Promise<GmailTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed");
  }

  return response.json();
}

export async function fetchUserInfo(
  accessToken: string,
): Promise<GmailUserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  return response.json();
}
