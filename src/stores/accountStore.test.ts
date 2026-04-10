import { describe, it, expect, beforeEach } from "vitest";
import { useAccountStore } from "./accountStore";

describe("accountStore", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
      isLoading: false,
    });
  });

  it("should have default state", () => {
    const state = useAccountStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.activeAccountId).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("should set active account", () => {
    useAccountStore.setState({
      accounts: [
        {
          id: "1",
          email: "test@example.com",
          name: "Test",
          picture: "",
          provider: "gmail_api",
          access_token: null,
          refresh_token: null,
          token_expiry: null,
        },
      ],
    });

    useAccountStore.getState().setActiveAccount("1");
    expect(useAccountStore.getState().activeAccountId).toBe("1");
  });

  it("should return active account", () => {
    const account = {
      id: "1",
      email: "test@example.com",
      name: "Test",
      picture: "",
      provider: "gmail_api" as const,
      access_token: null,
      refresh_token: null,
      token_expiry: null,
    };

    useAccountStore.setState({
      accounts: [account],
      activeAccountId: "1",
    });

    expect(useAccountStore.getState().getActiveAccount()).toEqual(account);
  });
});
