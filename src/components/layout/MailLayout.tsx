import { useEffect, useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ThreadList } from "./ThreadList";
import { ReadingPane } from "./ReadingPane";
import { Composer } from "../composer/Composer";
import { CommandPalette } from "../search/CommandPalette";
import { ShortcutsHelp } from "../search/ShortcutsHelp";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { syncInbox, syncLabels } from "../../services/gmail/sync";
import { initNotifications, notifyNewMessages } from "../../services/notifications/notificationManager";
import { updateBadgeCount } from "../../services/notifications/badgeManager";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export function MailLayout() {
  const { activeAccountId, getActiveAccount } = useAccountStore();
  const { loadThreads, setThreads, setSyncing, selectedThreadId, selectThread } =
    useThreadStore();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  useKeyboardShortcuts({
    onOpenSearch: useCallback(() => setIsCommandPaletteOpen(true), []),
    onToggleShortcutsHelp: useCallback(
      () => setIsShortcutsHelpOpen((prev) => !prev),
      [],
    ),
  });

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
  }, [getActiveAccount, activeAccountId, loadThreads, setThreads, setSyncing]);

  // When the active account changes, clear selection and re-sync
  useEffect(() => {
    if (!activeAccountId) return;
    selectThread(null);
    doSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId]);

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
      <ShortcutsHelp
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </div>
  );
}
