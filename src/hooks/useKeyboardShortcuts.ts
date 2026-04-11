import { useEffect, useRef, useCallback } from "react";
import { useThreadStore } from "@/stores/threadStore";
import { useComposerStore } from "@/stores/composerStore";
import { useAccountStore } from "@/stores/accountStore";
import {
  archiveThread,
  toggleStar,
  trashThread,
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
      if (e.ctrlKey || e.metaKey || e.altKey) {
        // Allow Ctrl+K / Cmd+K for search
        if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onOpenSearch();
        }
        return;
      }

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
// Actions on selected thread
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

  const { selectedThreadId, selectThread } = useThreadStore.getState();
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
