import { useEffect, useRef, useCallback } from "react";
import { useThreadStore } from "@/stores/threadStore";
import { useComposerStore } from "@/stores/composerStore";
import { useAccountStore } from "@/stores/accountStore";
import {
  archiveThread,
  toggleStar,
  trashThread,
  muteThread,
  unmuteThread,
  archiveThreads,
  trashThreads,
  starThreads,
  unstarThreads,
} from "@/services/emailActions";
import { unsubscribe, getUnsubscribeInfo } from "@/services/unsubscribe/unsubscribeManager";

interface UseKeyboardShortcutsOptions {
  onOpenSearch: () => void;
  onToggleShortcutsHelp: () => void;
  onNavigate?: (path: string) => void;
  onExtractTasks?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
  );
}

export function useKeyboardShortcuts({
  onOpenSearch,
  onToggleShortcutsHelp,
  onNavigate,
  onExtractTasks,
}: UseKeyboardShortcutsOptions): void {
  const pendingPrefixRef = useRef<string | null>(null);
  const prefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPrefix = useCallback(() => {
    pendingPrefixRef.current = null;
    if (prefixTimerRef.current !== null) {
      clearTimeout(prefixTimerRef.current);
      prefixTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "k") {
          e.preventDefault();
          onOpenSearch();
          return;
        }
        if (e.key === "a" && !e.altKey) {
          e.preventDefault();
          useThreadStore.getState().selectAllThreads();
          return;
        }
        return;
      }

      if (e.altKey) return;

      const key = e.key;

      // Handle second key in a g-prefixed sequence
      if (pendingPrefixRef.current === "g") {
        e.preventDefault();
        clearPrefix();
        if (key === "k" && onNavigate) {
          onNavigate("/tasks");
        } else {
          handleGSequence(key);
        }
        return;
      }

      // Start g-prefix sequence
      if (key === "g") {
        e.preventDefault();
        pendingPrefixRef.current = "g";
        prefixTimerRef.current = setTimeout(clearPrefix, 1000);
        return;
      }

      // Multi-select aware shortcuts
      const { isMultiSelectMode } = useThreadStore.getState();
      if (isMultiSelectMode()) {
        switch (key) {
          case "e":
            e.preventDefault();
            void archiveSelectedThreads();
            break;
          case "s":
            e.preventDefault();
            void starSelectedThreads();
            break;
          case "#":
          case "Delete":
          case "Backspace":
            e.preventDefault();
            void trashSelectedThreads();
            break;
          case "v":
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("velo-move-to-folder"));
            break;
          case "Escape":
            e.preventDefault();
            useThreadStore.getState().clearSelection();
            break;
          default:
            break;
        }
        return;
      }

      // Single-key shortcuts
      switch (key) {
        case "j":
          e.preventDefault();
          navigateThread(1);
          break;
        case "k":
          e.preventDefault();
          navigateThread(-1);
          break;
        case "o":
        case "Enter":
          e.preventDefault();
          openCurrentThread();
          break;
        case "c":
          e.preventDefault();
          useComposerStore.getState().openCompose();
          break;
        case "e":
          e.preventDefault();
          void archiveSelectedThread();
          break;
        case "s":
          e.preventDefault();
          void toggleStarSelectedThread();
          break;
        case "#":
        case "Delete":
        case "Backspace":
          e.preventDefault();
          void trashSelectedThread();
          break;
        case "r":
          e.preventDefault();
          replyToThread("reply");
          break;
        case "a":
          e.preventDefault();
          replyToThread("replyAll");
          break;
        case "f":
          e.preventDefault();
          replyToThread("forward");
          break;
        case "m":
          e.preventDefault();
          void toggleMuteSelectedThread();
          break;
        case "u":
          e.preventDefault();
          void unsubscribeSelectedThread();
          break;
        case "t":
          e.preventDefault();
          if (onExtractTasks) onExtractTasks();
          break;
        case "/":
          e.preventDefault();
          onOpenSearch();
          break;
        case "?":
          e.preventDefault();
          onToggleShortcutsHelp();
          break;
        case "Escape":
          handleEscape();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearPrefix();
    };
  }, [onOpenSearch, onToggleShortcutsHelp, onNavigate, onExtractTasks, clearPrefix]);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function navigateThread(direction: 1 | -1): void {
  const { threads, selectedThreadId, selectThread } =
    useThreadStore.getState();
  const { activeAccountId } = useAccountStore.getState();
  if (threads.length === 0) return;

  const currentIndex = threads.findIndex((t) => t.id === selectedThreadId);
  let nextIndex: number;

  if (currentIndex === -1) {
    // Nothing selected yet -- pick first or last depending on direction
    nextIndex = direction === 1 ? 0 : threads.length - 1;
  } else {
    nextIndex = currentIndex + direction;
  }

  // Clamp
  if (nextIndex < 0 || nextIndex >= threads.length) return;

  const nextThread = threads[nextIndex];
  if (nextThread) {
    void selectThread(nextThread.id, activeAccountId ?? undefined);
  }
}

function openCurrentThread(): void {
  const { threads, selectedThreadId, selectThread } =
    useThreadStore.getState();
  const { activeAccountId } = useAccountStore.getState();

  if (selectedThreadId) return; // Already open

  const first = threads[0];
  if (first) {
    void selectThread(first.id, activeAccountId ?? undefined);
  }
}

// ---------------------------------------------------------------------------
// Actions on selected thread (single)
// ---------------------------------------------------------------------------

function getSelectedThread() {
  const { threads, selectedThreadId } = useThreadStore.getState();
  if (!selectedThreadId) return null;
  return threads.find((t) => t.id === selectedThreadId) ?? null;
}

async function archiveSelectedThread(): Promise<void> {
  const thread = getSelectedThread();
  const account = useAccountStore.getState().getActiveAccount();
  if (!thread || !account) return;
  await archiveThread(account, thread.id);
}

async function toggleStarSelectedThread(): Promise<void> {
  const thread = getSelectedThread();
  const account = useAccountStore.getState().getActiveAccount();
  if (!thread || !account) return;
  await toggleStar(account, thread.id, thread.is_starred);
}

async function trashSelectedThread(): Promise<void> {
  const thread = getSelectedThread();
  const account = useAccountStore.getState().getActiveAccount();
  if (!thread || !account) return;
  await trashThread(account, thread.id);
}

async function toggleMuteSelectedThread(): Promise<void> {
  const thread = getSelectedThread();
  const account = useAccountStore.getState().getActiveAccount();
  if (!thread || !account) return;
  if (thread.is_muted) {
    await unmuteThread(account, thread.id);
  } else {
    await muteThread(account, thread.id);
  }
}

async function unsubscribeSelectedThread(): Promise<void> {
  const account = useAccountStore.getState().getActiveAccount();
  if (!account) return;

  const { messages } = useThreadStore.getState();
  // Find the first message in the thread that supports unsubscribe
  const target = messages.find(
    (m) => getUnsubscribeInfo(m).canUnsubscribe,
  );
  if (!target) return;

  await unsubscribe(account, target);
}

// ---------------------------------------------------------------------------
// Bulk actions on multi-selected threads
// ---------------------------------------------------------------------------

async function archiveSelectedThreads(): Promise<void> {
  const account = useAccountStore.getState().getActiveAccount();
  if (!account) return;
  const ids = Array.from(useThreadStore.getState().selectedThreadIds);
  if (ids.length === 0) return;
  useThreadStore.getState().clearSelection();
  await archiveThreads(account, ids);
}

async function trashSelectedThreads(): Promise<void> {
  const account = useAccountStore.getState().getActiveAccount();
  if (!account) return;
  const ids = Array.from(useThreadStore.getState().selectedThreadIds);
  if (ids.length === 0) return;
  useThreadStore.getState().clearSelection();
  await trashThreads(account, ids);
}

async function starSelectedThreads(): Promise<void> {
  const account = useAccountStore.getState().getActiveAccount();
  if (!account) return;
  const { selectedThreadIds, threads } = useThreadStore.getState();
  const ids = Array.from(selectedThreadIds);
  if (ids.length === 0) return;

  // If any selected thread is unstarred, star all; otherwise unstar all
  const idsSet = new Set(ids);
  const anyUnstarred = threads.some((t) => idsSet.has(t.id) && !t.is_starred);

  if (anyUnstarred) {
    await starThreads(account, ids);
  } else {
    await unstarThreads(account, ids);
  }
}

// ---------------------------------------------------------------------------
// Reply / Forward
// ---------------------------------------------------------------------------

function replyToThread(mode: "reply" | "replyAll" | "forward"): void {
  const { messages } = useThreadStore.getState();
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return;

  const composer = useComposerStore.getState();

  switch (mode) {
    case "reply":
      composer.openReply(lastMessage);
      break;
    case "replyAll": {
      const account = useAccountStore.getState().getActiveAccount();
      composer.openReplyAll(lastMessage, account?.email ?? "");
      break;
    }
    case "forward":
      composer.openForward(lastMessage);
      break;
  }
}

// ---------------------------------------------------------------------------
// Escape (hierarchical)
// ---------------------------------------------------------------------------

function handleEscape(): void {
  const composer = useComposerStore.getState();
  if (composer.isOpen) {
    composer.close();
    return;
  }

  const { selectedThreadIds, clearSelection, selectedThreadId, selectThread } = useThreadStore.getState();
  if (selectedThreadIds.size > 0) {
    clearSelection();
    return;
  }

  if (selectedThreadId) {
    void selectThread(null);
  }
}

// ---------------------------------------------------------------------------
// g-prefix navigation
// ---------------------------------------------------------------------------

const LABEL_MAP: Record<string, string> = {
  i: "INBOX",
  s: "STARRED",
  t: "SENT",
  d: "DRAFT",
};

function handleGSequence(key: string): void {
  const labelId = LABEL_MAP[key];
  if (!labelId) return;

  const { setActiveLabel, loadThreads } = useThreadStore.getState();
  const { activeAccountId } = useAccountStore.getState();

  setActiveLabel(labelId);
  if (activeAccountId) {
    void loadThreads(activeAccountId, labelId);
  }
}
