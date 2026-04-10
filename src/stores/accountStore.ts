import { create } from "zustand";
import type { Account } from "../types";
import {
  getAllAccounts,
  upsertAccount,
  deleteAccount as dbDeleteAccount,
} from "../services/db/accounts";

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  isLoading: boolean;
  loadAccounts: () => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  setActiveAccount: (id: string) => void;
  getActiveAccount: () => Account | null;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  isLoading: true,

  loadAccounts: async () => {
    set({ isLoading: true });
    const accounts = await getAllAccounts();
    set({
      accounts,
      activeAccountId: accounts[0]?.id ?? null,
      isLoading: false,
    });
  },

  addAccount: async (account) => {
    await upsertAccount(account);
    const accounts = await getAllAccounts();
    set({ accounts, activeAccountId: account.id });
  },

  removeAccount: async (id) => {
    await dbDeleteAccount(id);
    const accounts = await getAllAccounts();
    set({
      accounts,
      activeAccountId:
        get().activeAccountId === id
          ? (accounts[0]?.id ?? null)
          : get().activeAccountId,
    });
  },

  setActiveAccount: (id) => set({ activeAccountId: id }),

  getActiveAccount: () => {
    const { accounts, activeAccountId } = get();
    return accounts.find((a) => a.id === activeAccountId) ?? null;
  },
}));
