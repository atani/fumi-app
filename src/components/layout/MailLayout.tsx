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
import { startSnoozeChecker, stopSnoozeChecker } from "../../services/snooze/snoozeChecker";

export function MailLayout() {
  const { activeAccountId, getActiveAccount } = useAccountStore();
  const { loadThreads, setThreads, setSyncing, selectedThreadId, selectThread } =
    useThreadStore();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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
    setSyncError(null);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Sync error:", msg);
      setSyncError(msg);
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

    startSnoozeChecker(() => getActiveAccount());

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
      stopSnoozeChecker();
      unlistenTray?.();
    };
  }, [doSync, getActiveAccount]);

  return (
    <div className="flex h-screen bg-bg-primary" data-testid="mail-layout">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Drag region spanning the content area */}
        <div
          className="h-10 shrink-0"
          data-tauri-drag-region
        />
        {syncError && (
          <div className="shrink-0 border-b border-danger bg-danger/10 px-4 py-2 text-xs text-danger">
            Sync error: {syncError}
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <ThreadList onOpenSearch={() => setIsCommandPaletteOpen(true)} />
          {selectedThreadId && <ReadingPane />}
        </div>
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
