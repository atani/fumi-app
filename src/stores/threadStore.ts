import { create } from "zustand";
import type { Thread, Message } from "../types";
import type { ThreadCategory } from "../services/ai/aiService";
import {
  getThreadsByLabel,
  getThreadCategoriesForAccount,
  getCategoryCountsForThreads,
} from "../services/db/threads";
import { getMessagesByThread } from "../services/db/messages";

interface ThreadState {
  threads: Thread[];
  selectedThreadId: string | null;
  selectedThreadIds: Set<string>;
  lastSelectedThreadId: string | null;
  messages: Message[];
  activeLabel: string;
  activeCategory: ThreadCategory | null;
  categoryMap: Record<string, ThreadCategory>;
  categoryCounts: Record<string, number>;
  isLoading: boolean;
  isSyncing: boolean;
  loadThreads: (accountId: string, labelId?: string) => Promise<void>;
  selectThread: (threadId: string | null, accountId?: string) => Promise<void>;
  toggleSelectThread: (threadId: string) => void;
  selectRange: (fromId: string, toId: string) => void;
  selectAllThreads: () => void;
  clearSelection: () => void;
  isMultiSelectMode: () => boolean;
  setActiveLabel: (labelId: string) => void;
  setActiveCategory: (category: ThreadCategory | null) => void;
  setThreads: (threads: Thread[]) => void;
  setSyncing: (syncing: boolean) => void;
  updateThread: (threadId: string, updates: Partial<Pick<Thread, "is_read" | "is_starred" | "is_muted">>) => void;
  removeThread: (threadId: string) => void;
  removeThreads: (threadIds: string[]) => void;
  updateThreads: (threadIds: string[], updates: Partial<Pick<Thread, "is_read" | "is_starred" | "is_muted">>) => void;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  threads: [],
  selectedThreadId: null,
  selectedThreadIds: new Set<string>(),
  lastSelectedThreadId: null,
  messages: [],
  activeLabel: "INBOX",
  activeCategory: null,
  categoryMap: {},
  categoryCounts: {},
  isLoading: false,
  isSyncing: false,

  loadThreads: async (accountId, labelId) => {
    const label = labelId ?? get().activeLabel;
    set({ isLoading: true });
    const threads = await getThreadsByLabel(accountId, label);

    if (label === "INBOX") {
      const [categoryMap, categoryCounts] = await Promise.all([
        getThreadCategoriesForAccount(accountId),
        getCategoryCountsForThreads(
          accountId,
          threads.map((t) => t.id),
        ),
      ]);
      set({ threads, isLoading: false, activeLabel: label, categoryMap, categoryCounts });
    } else {
      set({ threads, isLoading: false, activeLabel: label, activeCategory: null, categoryMap: {}, categoryCounts: {} });
    }
  },

  selectThread: async (threadId, accountId) => {
    set({ selectedThreadId: threadId });
    if (threadId && accountId) {
      const messages = await getMessagesByThread(accountId, threadId);
      set({ messages });
    } else {
      set({ messages: [] });
    }
  },

  setActiveLabel: (labelId) => set({ activeLabel: labelId }),

  setActiveCategory: (category) => set({ activeCategory: category }),

  setThreads: (threads) => set({ threads }),

  setSyncing: (syncing) => set({ isSyncing: syncing }),

  toggleSelectThread: (threadId) =>
    set((state) => {
      const next = new Set(state.selectedThreadIds);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return { selectedThreadIds: next, lastSelectedThreadId: threadId };
    }),

  selectRange: (fromId, toId) =>
    set((state) => {
      const ids = state.threads.map((t) => t.id);
      const fromIdx = ids.indexOf(fromId);
      const toIdx = ids.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return state;
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const next = new Set(state.selectedThreadIds);
      for (let i = start; i <= end; i++) {
        const id = ids[i];
        if (id !== undefined) {
          next.add(id);
        }
      }
      return { selectedThreadIds: next, lastSelectedThreadId: toId };
    }),

  selectAllThreads: () =>
    set((state) => ({
      selectedThreadIds: new Set(state.threads.map((t) => t.id)),
    })),

  clearSelection: () =>
    set({ selectedThreadIds: new Set<string>(), lastSelectedThreadId: null }),

  isMultiSelectMode: () => get().selectedThreadIds.size > 0,

  updateThread: (threadId, updates) =>
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, ...updates } : t,
      ),
    })),

  removeThread: (threadId) =>
    set((state) => {
      const idx = state.threads.findIndex((t) => t.id === threadId);
      const filtered = state.threads.filter((t) => t.id !== threadId);

      // Auto-select the next thread (or previous if last item was removed)
      let nextSelectedId: string | null = null;
      if (state.selectedThreadId === threadId && filtered.length > 0) {
        const nextIdx = Math.min(idx, filtered.length - 1);
        nextSelectedId = filtered[nextIdx]?.id ?? null;
      } else {
        nextSelectedId = state.selectedThreadId;
      }

      return {
        threads: filtered,
        selectedThreadId: nextSelectedId,
        // Clear messages if the removed thread was selected
        messages: state.selectedThreadId === threadId ? [] : state.messages,
      };
    }),

  removeThreads: (threadIds) =>
    set((state) => {
      const idsToRemove = new Set(threadIds);
      const filtered = state.threads.filter((t) => !idsToRemove.has(t.id));

      let nextSelectedId: string | null = null;
      if (state.selectedThreadId && idsToRemove.has(state.selectedThreadId)) {
        // Select next available thread
        const oldIdx = state.threads.findIndex((t) => t.id === state.selectedThreadId);
        const nextIdx = Math.min(oldIdx, filtered.length - 1);
        nextSelectedId = filtered[nextIdx]?.id ?? null;
      } else {
        nextSelectedId = state.selectedThreadId;
      }

      // Clear multi-select for removed threads
      const nextSelected = new Set(state.selectedThreadIds);
      for (const id of threadIds) {
        nextSelected.delete(id);
      }

      return {
        threads: filtered,
        selectedThreadId: nextSelectedId,
        selectedThreadIds: nextSelected,
        messages: state.selectedThreadId && idsToRemove.has(state.selectedThreadId) ? [] : state.messages,
      };
    }),

  updateThreads: (threadIds, updates) =>
    set((state) => {
      const idsSet = new Set(threadIds);
      return {
        threads: state.threads.map((t) =>
          idsSet.has(t.id) ? { ...t, ...updates } : t,
        ),
      };
    }),
}));
