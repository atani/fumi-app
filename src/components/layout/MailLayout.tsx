import { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ThreadList } from "./ThreadList";
import { ReadingPane } from "./ReadingPane";
import { DndProvider } from "../dnd/DndProvider";
import { Composer } from "../composer/Composer";
import { CommandPalette } from "../search/CommandPalette";
import { ShortcutsHelp } from "../search/ShortcutsHelp";
import { OfflineBanner } from "../ui/OfflineBanner";
import { AiTaskExtractDialog } from "../tasks/AiTaskExtractDialog";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { useUIStore } from "../../stores/uiStore";
import { syncInbox, syncLabels } from "../../services/gmail/sync";
import { initNotifications, notifyNewMessages } from "../../services/notifications/notificationManager";
import { updateBadgeCount } from "../../services/notifications/badgeManager";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { startSnoozeChecker, stopSnoozeChecker } from "../../services/snooze/snoozeChecker";
import { startBundleChecker, stopBundleChecker } from "../../services/bundles/bundleChecker";
import { startFollowUpChecker, stopFollowUpChecker } from "../../services/followup/followupChecker";
import { startQueueProcessor, stopQueueProcessor, processQueue } from "../../services/queue/queueProcessor";
import { startScheduledSendChecker, stopScheduledSendChecker } from "../../services/snooze/scheduledSendChecker";
import { fetchSendAsAliases } from "../../services/gmail/sendAs";
import { initDeepLinkHandler } from "../../services/deepLinkHandler";

export function MailLayout() {
  const navigate = useNavigate();
  const { activeAccountId, getActiveAccount } = useAccountStore();
  const { loadThreads, setThreads, setSyncing, selectedThreadId, messages, selectThread } =
    useThreadStore();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isTaskExtractOpen, setIsTaskExtractOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useKeyboardShortcuts({
    onOpenSearch: useCallback(() => setIsCommandPaletteOpen(true), []),
    onToggleShortcutsHelp: useCallback(
      () => setIsShortcutsHelpOpen((prev) => !prev),
      [],
    ),
    onNavigate: useCallback((path: string) => navigate(path), [navigate]),
    onExtractTasks: useCallback(() => {
      if (selectedThreadId) {
        setIsTaskExtractOpen(true);
      }
    }, [selectedThreadId]),
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
        await notifyNewMessages(newThreads, account.id);
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

  // When the active account changes, clear selection, re-sync, and fetch send-as aliases
  useEffect(() => {
    if (!activeAccountId) return;
    selectThread(null);
    doSync();

    // Fetch send-as aliases for Gmail API accounts
    const account = getActiveAccount();
    if (account?.provider === "gmail_api") {
      fetchSendAsAliases(account).catch((err) => {
        console.error("Failed to fetch send-as aliases:", err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId]);

  // Network status detection — update store and flush queue on reconnect
  useEffect(() => {
    const handleOnline = () => {
      useUIStore.getState().setOnline(true);
      // Flush pending operations on reconnect
      void processQueue();
    };
    const handleOffline = () => {
      useUIStore.getState().setOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    initNotifications();
    doSync();

    const interval = setInterval(doSync, 60_000);

    startSnoozeChecker(() => getActiveAccount());
    startBundleChecker(() => getActiveAccount());
    startFollowUpChecker(() => getActiveAccount());
    startQueueProcessor();
    startScheduledSendChecker();

    let unlistenTray: (() => void) | undefined;
    let cleanupDeepLink: (() => void) | undefined;

    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen("tray-check-mail", () => {
          doSync();
        }).then((fn) => {
          unlistenTray = fn;
        });
      });

      initDeepLinkHandler().then((cleanup) => {
        cleanupDeepLink = cleanup;
      }).catch((err) => {
        console.error("Failed to initialize deep link handler:", err);
      });
    }

    return () => {
      clearInterval(interval);
      stopSnoozeChecker();
      stopBundleChecker();
      stopFollowUpChecker();
      stopQueueProcessor();
      stopScheduledSendChecker();
      unlistenTray?.();
      cleanupDeepLink?.();
    };
  }, [doSync, getActiveAccount]);

  return (
    <DndProvider>
    <div className="flex h-screen bg-bg-primary" data-testid="mail-layout">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Drag region spanning the content area */}
        <div
          className="h-10 shrink-0 bg-bg-primary"
          data-tauri-drag-region
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
        <OfflineBanner />
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
      {selectedThreadId && activeAccountId && (
        <AiTaskExtractDialog
          isOpen={isTaskExtractOpen}
          onClose={() => setIsTaskExtractOpen(false)}
          messages={messages}
          threadId={selectedThreadId}
          accountId={activeAccountId}
        />
      )}
    </div>
    </DndProvider>
  );
}
