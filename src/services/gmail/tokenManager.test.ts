import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAccountStore } from "../../stores/accountStore";

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0 });
const mockSelect = vi.fn().mockResolvedValue([]);

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}));

const mockRefreshAccessToken = vi.fn();
const mockGetClientId = vi.fn();

vi.mock("./auth", () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  getClientId: () => mockGetClientId(),
}));

const mockUpdateTokens = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/accounts", () => ({
  updateTokens: (...args: unknown[]) => mockUpdateTokens(...args),
}));

const { getValidAccessToken, withTokenRefresh } = await import(
  "./tokenManager"
);

function makeAccount(overrides = {}) {
  return {
    id: "acc-1",
    email: "test@example.com",
    name: "Test User",
    picture: "",
    provider: "gmail_api" as const,
    access_token: "valid-token",
    refresh_token: "refresh-token",
    token_expiry: null as number | null,
    ...overrides,
  };
}

describe("tokenManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getClientId returns a valid client ID
    mockGetClientId.mockResolvedValue("test-client-id");
    // Default: no client secret in DB
    mockSelect.mockResolvedValue([]);
    // Default: refreshAccessToken returns a new token
    mockRefreshAccessToken.mockResolvedValue({
      access_token: "new-token",
      refresh_token: null,
      expires_in: 3600,
    });
    // Reset account store
    useAccountStore.setState({ accounts: [] });
  });

  describe("isTokenExpiringSoon (via getValidAccessToken)", () => {
    it("treats null token_expiry as expired and triggers refresh", async () => {
      const account = makeAccount({ token_expiry: null });
      useAccountStore.setState({ accounts: [account] });

      const token = await getValidAccessToken(account);

      expect(token).toBe("new-token");
      expect(mockRefreshAccessToken).toHaveBeenCalled();
    });

    it("returns cached token when expiry is far in the future (epoch seconds)", async () => {
      // 1 hour from now in seconds
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      const account = makeAccount({ token_expiry: futureExpiry });

      const token = await getValidAccessToken(account);

      expect(token).toBe("valid-token");
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("returns cached token when expiry is far in the future (epoch milliseconds)", async () => {
      // 1 hour from now in milliseconds
      const futureExpiryMs = Date.now() + 3600 * 1000;
      const account = makeAccount({ token_expiry: futureExpiryMs });

      const token = await getValidAccessToken(account);

      expect(token).toBe("valid-token");
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("refreshes when token is within 5-minute buffer (epoch seconds)", async () => {
      // 2 minutes from now — inside the 5-minute buffer
      const soonExpiry = Math.floor(Date.now() / 1000) + 120;
      const account = makeAccount({ token_expiry: soonExpiry });
      useAccountStore.setState({ accounts: [account] });

      const token = await getValidAccessToken(account);

      expect(token).toBe("new-token");
      expect(mockRefreshAccessToken).toHaveBeenCalled();
    });

    it("refreshes when token is already expired", async () => {
      // 10 minutes ago
      const pastExpiry = Math.floor(Date.now() / 1000) - 600;
      const account = makeAccount({ token_expiry: pastExpiry });
      useAccountStore.setState({ accounts: [account] });

      const token = await getValidAccessToken(account);

      expect(token).toBe("new-token");
      expect(mockRefreshAccessToken).toHaveBeenCalled();
    });
  });

  describe("getValidAccessToken", () => {
    it("updates DB and account store after refresh", async () => {
      const account = makeAccount({ token_expiry: null });
      useAccountStore.setState({ accounts: [account] });

      await getValidAccessToken(account);

      expect(mockUpdateTokens).toHaveBeenCalledWith(
        "acc-1",
        "new-token",
        null,
        expect.any(Number),
      );

      const updatedAccounts = useAccountStore.getState().accounts;
      expect(updatedAccounts[0]?.access_token).toBe("new-token");
    });

    it("throws if no refresh token is available", async () => {
      const account = makeAccount({
        token_expiry: null,
        refresh_token: null,
      });

      await expect(getValidAccessToken(account)).rejects.toThrow(
        "No refresh token",
      );
    });

    it("throws if client ID is not configured", async () => {
      mockGetClientId.mockResolvedValue(null);
      const account = makeAccount({ token_expiry: null });

      await expect(getValidAccessToken(account)).rejects.toThrow(
        "client ID not configured",
      );
    });
  });

  describe("withTokenRefresh", () => {
    it("calls the API with a valid token", async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      const account = makeAccount({ token_expiry: futureExpiry });
      const apiCall = vi.fn().mockResolvedValue("api-result");

      const result = await withTokenRefresh(account, apiCall);

      expect(result).toBe("api-result");
      expect(apiCall).toHaveBeenCalledWith("valid-token");
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it("retries once on 401 error with a fresh token", async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      const account = makeAccount({ token_expiry: futureExpiry });
      useAccountStore.setState({ accounts: [account] });

      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(new Error("Request failed (401)"))
        .mockResolvedValueOnce("retry-result");

      const result = await withTokenRefresh(account, apiCall);

      expect(result).toBe("retry-result");
      expect(apiCall).toHaveBeenCalledTimes(2);
      // First call with original token, second with refreshed token
      expect(apiCall).toHaveBeenNthCalledWith(1, "valid-token");
      expect(apiCall).toHaveBeenNthCalledWith(2, "new-token");
    });

    it("throws non-401 errors without retrying", async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      const account = makeAccount({ token_expiry: futureExpiry });

      const apiCall = vi
        .fn()
        .mockRejectedValue(new Error("Network error (500)"));

      await expect(withTokenRefresh(account, apiCall)).rejects.toThrow(
        "Network error (500)",
      );
      expect(apiCall).toHaveBeenCalledTimes(1);
    });
  });
});
