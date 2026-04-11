import { create } from "zustand";
import type { SmartFolder } from "../types";
import {
  getSmartFoldersByAccount,
  insertSmartFolder,
  updateSmartFolderInDb,
  deleteSmartFolderFromDb,
} from "../services/db/smartFolders";

interface SmartFolderState {
  folders: SmartFolder[];
  activeSmartFolderId: string | null;

  loadFolders: (accountId: string) => Promise<void>;
  createFolder: (folder: SmartFolder) => Promise<void>;
  updateFolder: (
    id: string,
    accountId: string,
    updates: Partial<Pick<SmartFolder, "name" | "query" | "icon" | "sort_order">>,
  ) => Promise<void>;
  deleteFolder: (id: string, accountId: string) => Promise<void>;
  setActiveSmartFolderId: (id: string | null) => void;
}

export const useSmartFolderStore = create<SmartFolderState>((set, get) => ({
  folders: [],
  activeSmartFolderId: null,

  loadFolders: async (accountId) => {
    const folders = await getSmartFoldersByAccount(accountId);
    set({ folders });
  },

  createFolder: async (folder) => {
    await insertSmartFolder(folder);
    set({ folders: [...get().folders, folder] });
  },

  updateFolder: async (id, accountId, updates) => {
    await updateSmartFolderInDb(id, accountId, updates);
    set({
      folders: get().folders.map((f) =>
        f.id === id && f.account_id === accountId ? { ...f, ...updates } : f,
      ),
    });
  },

  deleteFolder: async (id, accountId) => {
    await deleteSmartFolderFromDb(id, accountId);
    set({
      folders: get().folders.filter(
        (f) => !(f.id === id && f.account_id === accountId),
      ),
      activeSmartFolderId:
        get().activeSmartFolderId === id ? null : get().activeSmartFolderId,
    });
  },

  setActiveSmartFolderId: (id) => set({ activeSmartFolderId: id }),
}));
