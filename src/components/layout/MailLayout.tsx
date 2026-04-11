import { useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { ThreadList } from "./ThreadList";
import { ReadingPane } from "./ReadingPane";
import { useAccountStore } from "../../stores/accountStore";
import { useThreadStore } from "../../stores/threadStore";
import { syncInbox, syncLabels } from "../../services/gmail/sync";

export function MailLayout() {
  const { getActiveAccount } = useAccountStore();
  const { loadThreads, setThreads, setSyncing, selectedThreadId } =
    useThreadStore();

  const doSync = useCallback(async () => {
    const account = getActiveAccount();
    if (!account?.access_token) return;

    setSyncing(true);
    try {
      await syncLabels(account);
      const threads = await syncInbox(account);
      if (threads.length > 0) {
        setThreads(threads);
      }
      await loadThreads(account.id);
    } finally {
      setSyncing(false);
    }
  }, [getActiveAccount, loadThreads, setThreads, setSyncing]);

  useEffect(() => {
    doSync();

    const interval = setInterval(doSync, 60_000);
    return () => clearInterval(interval);
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
        <ThreadList />
        {selectedThreadId && <ReadingPane />}
      </div>
    </div>
  );
}
