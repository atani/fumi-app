import { useState } from "react";
import { Mail } from "lucide-react";
import { useAccountStore } from "../../stores/accountStore";
import {
  getClientId,
  startOAuthFlow,
  exchangeCodeForTokens,
  fetchUserInfo,
} from "../../services/gmail/auth";
import type { Account } from "../../types";

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClientIdInput, setShowClientIdInput] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");
  const { addAccount } = useAccountStore();

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      let clientId = await getClientId();

      if (!clientId) {
        setShowClientIdInput(true);
        setIsLoading(false);
        return;
      }

      await performOAuth(clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setIsLoading(false);
    }
  };

  const handleClientIdSubmit = async () => {
    if (!clientIdInput.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const { getDb } = await import("../../services/db/connection");
      const db = await getDb();
      await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('google_client_id', $1)",
        [clientIdInput.trim()],
      );

      await performOAuth(clientIdInput.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setIsLoading(false);
    }
  };

  const performOAuth = async (clientId: string) => {
    const { code, codeVerifier, redirectUri } =
      await startOAuthFlow(clientId);

    const tokens = await exchangeCodeForTokens(
      clientId,
      code,
      codeVerifier,
      redirectUri,
    );

    const userInfo = await fetchUserInfo(tokens.access_token);

    const account: Account = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      provider: "gmail_api",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: Date.now() + tokens.expires_in * 1000,
    };

    await addAccount(account);
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-sm px-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light">
            <Mail className="h-8 w-8 text-accent" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-text-primary">Fumi</h1>
          <p className="mt-2 text-text-secondary">
            Fast, lightweight email client
          </p>
        </div>

        <div className="mt-10">
          {showClientIdInput ? (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Enter your Google OAuth Client ID to get started.
              </p>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="Client ID"
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                data-testid="client-id-input"
              />
              <button
                onClick={handleClientIdSubmit}
                disabled={isLoading || !clientIdInput.trim()}
                className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                data-testid="submit-client-id"
              >
                {isLoading ? "Connecting..." : "Continue"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border-primary bg-bg-primary px-4 py-3 text-sm font-medium text-text-primary shadow-sm hover:bg-bg-hover disabled:opacity-50"
              data-testid="google-login-button"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {isLoading ? "Connecting..." : "Sign in with Google"}
            </button>
          )}

          {error && (
            <p className="mt-4 text-center text-sm text-danger" data-testid="login-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
