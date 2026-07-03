import { useEffect, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { ThreadList } from "./ThreadList";
import { ReadingPane } from "./ReadingPane";
import { DndProvider } from "../dnd/DndProvider";
import { Composer } from "../composer/Composer";
import { CommandPalette } from "../search/CommandPalette";
import { ShortcutsHelp } from "../search/ShortcutsHelp";
import { WelcomeHint } from "../onboarding/WelcomeHint";
import { OfflineBanner } from "../ui/OfflineBanner";
import { EmptyState } from "../ui/EmptyState";
import { ReadingPaneIllustration } from "../ui/illustrations";
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
import { initGlobalShortcut } from "../../services/globalShortcut";

export function MailLayout() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeAccountId, getActiveAccount } = useAccountStore();
  const { loadThreads, setThreads, setSyncing, selectedThreadId, messages, selectThread } =
    useThreadStore();
  const readingPanePosition = useUIStore((s) => s.readingPanePosition);
  const emailListWidth = useUIStore((s) => s.emailListWidth);
  const setEmailListWidth = useUIStore((s) => s.setEmailListWidth);
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

  // --- Email list resize handle ---
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);

  useEffect(() => {
    if (!isDraggingHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const newWidth = dragRef.current.startWidth + (e.clientX - dragRef.current.startX);
      setEmailListWidth(Math.max(200, Math.min(600, newWidth)));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setIsDraggingHandle(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingHandle, setEmailListWidth]);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: emailListWidth };
      setIsDraggingHandle(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [emailListWidth],
  );

  // True while a sync is in flight, to prevent overlapping runs.
  const syncingRef = useRef(false);

  const doSync = useCallback(async () => {
    const account = getActiveAccount();
    if (!account?.access_token && !account?.refresh_token) return;

    // Guard against overlapping syncs: the 60s interval, tray "check mail", and
    // account changes can all trigger doSync while a slow sync is still running.
    if (syncingRef.current) return;
    syncingRef.current = true;

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
      syncingRef.current = false;
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
    let cleanupGlobalShortcut: (() => void) | undefined;

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

      initGlobalShortcut().then((cleanup) => {
        cleanupGlobalShortcut = cleanup;
      }).catch((err) => {
        console.error("Failed to initialize global shortcut:", err);
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
      cleanupGlobalShortcut?.();
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
            {t("layout.syncError", { error: syncError })}
          </div>
        )}
        <div className={`flex flex-1 overflow-hidden ${readingPanePosition === "bottom" ? "flex-col" : "flex-row"}`}>
          {readingPanePosition === "hidden" && selectedThreadId ? (
            <ReadingPane onBack={() => selectThread(null)} showBackButton />
          ) : (
            <>
              <ThreadList onOpenSearch={() => setIsCommandPaletteOpen(true)} />
              {readingPanePosition === "right" && (
                <div
                  onMouseDown={handleResizeMouseDown}
                  className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40"
                  data-testid="email-list-resize-handle"
                />
              )}
              {readingPanePosition !== "hidden" && (
                selectedThreadId ? (
                  <ReadingPane />
                ) : (
                  <div className="flex flex-1 items-center justify-center bg-bg-primary">
                    <EmptyState
                      illustration={<ReadingPaneIllustration />}
                      title={t("layout.selectConversation")}
                      description={t("layout.selectConversationHint")}
                    />
                  </div>
                )
              )}
            </>
          )}
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
      <WelcomeHint />
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
