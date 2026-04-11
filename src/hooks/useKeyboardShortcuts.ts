import { useEffect, useRef, useCallback } from "react";
import { useThreadStore } from "@/stores/threadStore";
import { useComposerStore } from "@/stores/composerStore";
import { useAccountStore } from "@/stores/accountStore";
import { useShortcutStore } from "@/stores/shortcutStore";
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

/** Convert a KeyboardEvent to the combo string used in the store's keyMap. */
function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && e.key.length > 1) parts.push("Shift");
  parts.push(e.key);
  return parts.join("+");
}

// Map from g-sequence action IDs to the label IDs they navigate to.
const G_SEQUENCE_LABEL_MAP: Record<string, string> = {
  go_inbox: "INBOX",
  go_starred: "STARRED",
  go_sent: "SENT",
  go_drafts: "DRAFT",
};

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

      // Always read the latest keyMap from the store (no stale closure).
      const { reverseMap, keyMap } = useShortcutStore.getState();

      // --- Escape is non-customizable (hierarchical behavior) ---
      if (e.key === "Escape") {
        handleEscape();
        return;
      }

      // --- Ctrl+A (select all) is non-customizable ---
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !e.altKey) {
        e.preventDefault();
        useThreadStore.getState().selectAllThreads();
        return;
      }

      // --- Handle second key in a g-prefix sequence ---
      if (pendingPrefixRef.current === "g") {
        e.preventDefault();
        clearPrefix();
        const gCombo = `g ${e.key}`;
        const actionId = reverseMap.get(gCombo);
        if (actionId) {
          if (actionId === "go_tasks" && onNavigate) {
            onNavigate("/tasks");
          } else if (actionId === "go_attachments" && onNavigate) {
            onNavigate("/attachments");
          } else {
            const labelId = G_SEQUENCE_LABEL_MAP[actionId];
            if (labelId) {
              handleGSequence(labelId);
            }
          }
        }
        return;
      }

      // --- Start g-prefix sequence if any g-sequence binding exists ---
      if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Check that at least one g-sequence action exists in the keyMap
        const hasGBinding = Object.values(keyMap).some((combo) =>
          combo.startsWith("g "),
        );
        if (hasGBinding) {
          e.preventDefault();
          pendingPrefixRef.current = "g";
          prefixTimerRef.current = setTimeout(clearPrefix, 1000);
          return;
        }
      }

      // --- Build combo string for this event ---
      const combo = eventToCombo(e);

      // --- Multi-select aware ---
      const { isMultiSelectMode } = useThreadStore.getState();
      if (isMultiSelectMode()) {
        const actionId = reverseMap.get(combo);
        if (actionId) {
          e.preventDefault();
          dispatchMultiSelectAction(actionId);
        }
        return;
      }

      // --- Single-key lookup ---
      const actionId = reverseMap.get(combo);
      if (actionId) {
        e.preventDefault();
        dispatchSingleAction(actionId, onOpenSearch, onToggleShortcutsHelp, onExtractTasks);
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
// Action dispatchers
// ---------------------------------------------------------------------------

function dispatchMultiSelectAction(actionId: string): void {
  switch (actionId) {
    case "archive":
      void archiveSelectedThreads();
      break;
    case "toggle_star":
      void starSelectedThreads();
      break;
    case "trash":
      void trashSelectedThreads();
      break;
    case "move_to_folder":
      window.dispatchEvent(new CustomEvent("velo-move-to-folder"));
      break;
    default:
      break;
  }
}

function dispatchSingleAction(
  actionId: string,
  onOpenSearch: () => void,
  onToggleShortcutsHelp: () => void,
  onExtractTasks?: () => void,
): void {
  switch (actionId) {
    case "navigate_next":
      navigateThread(1);
      break;
    case "navigate_prev":
      navigateThread(-1);
      break;
    case "open_thread":
      openCurrentThread();
      break;
    case "compose":
      useComposerStore.getState().openCompose();
      break;
    case "archive":
      void archiveSelectedThread();
      break;
    case "toggle_star":
      void toggleStarSelectedThread();
      break;
    case "trash":
      void trashSelectedThread();
      break;
    case "reply":
      replyToThread("reply");
      break;
    case "reply_all":
      replyToThread("replyAll");
      break;
    case "forward":
      replyToThread("forward");
      break;
    case "mute":
      void toggleMuteSelectedThread();
      break;
    case "unsubscribe":
      void unsubscribeSelectedThread();
      break;
    case "move_to_folder":
      window.dispatchEvent(new CustomEvent("velo-move-to-folder"));
      break;
    case "extract_tasks":
      if (onExtractTasks) onExtractTasks();
      break;
    case "search":
    case "search_ctrl":
      onOpenSearch();
      break;
    case "shortcuts_help":
      onToggleShortcutsHelp();
      break;
    default:
      break;
  }
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
// Escape (hierarchical) — non-customizable
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

function handleGSequence(labelId: string): void {
  const { setActiveLabel, loadThreads } = useThreadStore.getState();
  const { activeAccountId } = useAccountStore.getState();

  setActiveLabel(labelId);
  if (activeAccountId) {
    void loadThreads(activeAccountId, labelId);
  }
}
