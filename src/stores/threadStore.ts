import { create } from "zustand";
import type { Thread, Message } from "../types";
import { getThreadsByLabel } from "../services/db/threads";
import { getMessagesByThread } from "../services/db/messages";

interface ThreadState {
  threads: Thread[];
  selectedThreadId: string | null;
  messages: Message[];
  activeLabel: string;
  isLoading: boolean;
  isSyncing: boolean;
  loadThreads: (accountId: string, labelId?: string) => Promise<void>;
  selectThread: (threadId: string | null, accountId?: string) => Promise<void>;
  setActiveLabel: (labelId: string) => void;
  setThreads: (threads: Thread[]) => void;
  setSyncing: (syncing: boolean) => void;
  updateThread: (threadId: string, updates: Partial<Pick<Thread, "is_read" | "is_starred">>) => void;
  removeThread: (threadId: string) => void;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  threads: [],
  selectedThreadId: null,
  messages: [],
  activeLabel: "INBOX",
  isLoading: false,
  isSyncing: false,

  loadThreads: async (accountId, labelId) => {
    const label = labelId ?? get().activeLabel;
    set({ isLoading: true });
    const threads = await getThreadsByLabel(accountId, label);
    set({ threads, isLoading: false, activeLabel: label });
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

  setThreads: (threads) => set({ threads }),

  setSyncing: (syncing) => set({ isSyncing: syncing }),

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
}));
