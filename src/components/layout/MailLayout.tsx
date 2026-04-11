import { useEffect, useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ThreadList } from "./ThreadList";
import { ReadingPane } from "./ReadingPane";
import { Composer } from "../composer/Composer";
import { CommandPalette } from "../search/CommandPalette";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { useComposerStore } from "../../stores/composerStore";
import { syncInbox, syncLabels } from "../../services/gmail/sync";
import { initNotifications, notifyNewMessages } from "../../services/notifications/notificationManager";
import { updateBadgeCount } from "../../services/notifications/badgeManager";

export function MailLayout() {
  const { getActiveAccount } = useAccountStore();
  const { loadThreads, setThreads, setSyncing, selectedThreadId } =
    useThreadStore();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const doSync = useCallback(async () => {
    const account = getActiveAccount();
    if (!account?.access_token && !account?.refresh_token) return;

    setSyncing(true);
    try {
      await syncLabels(account);
      const { threads, newThreads } = await syncInbox(account);
      if (threads.length > 0) {
        setThreads(threads);
      }
      await loadThreads(account.id);

      if (newThreads.length > 0) {
        await notifyNewMessages(newThreads);
      }
      await updateBadgeCount(account.id);
    } finally {
      setSyncing(false);
    }
  }, [getActiveAccount, loadThreads, setThreads, setSyncing]);

  useEffect(() => {
    initNotifications();
    doSync();

    const interval = setInterval(doSync, 60_000);

    let unlistenTray: (() => void) | undefined;

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen("tray-check-mail", () => {
          doSync();
        }).then((fn) => {
          unlistenTray = fn;
        });
      });
    }

    return () => {
      clearInterval(interval);
      unlistenTray?.();
    };
  }, [doSync]);

  // 'c' keyboard shortcut for compose
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        useComposerStore.getState().openCompose();
      }

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    const handleCtrlK = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleCtrlK);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", handleCtrlK);
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-bg-primary" data-testid="mail-layout">
      {/* Drag region for window movement */}
      <div
        className="h-12 shrink-0 border-b border-border-primary"
        data-tauri-drag-region
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ThreadList onOpenSearch={() => setIsCommandPaletteOpen(true)} />
        {selectedThreadId && <ReadingPane />}
      </div>
      <Composer />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
