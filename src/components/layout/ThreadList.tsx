import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { RefreshCw } from "lucide-react";

export function ThreadList() {
  const { threads, selectedThreadId, selectThread, isLoading, isSyncing } =
    useThreadStore();
  const { activeAccountId } = useAccountStore();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div
      className="flex w-80 flex-col border-r border-border-primary bg-bg-primary"
      data-testid="thread-list"
    >
      <div className="flex h-12 items-center justify-between border-b border-border-primary px-4">
        <h2 className="text-sm font-semibold text-text-primary">
          {useThreadStore.getState().activeLabel}
        </h2>
        {isSyncing && (
          <RefreshCw className="h-4 w-4 animate-spin text-text-tertiary" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-text-tertiary">Loading...</p>
          </div>
        ) : threads.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-text-tertiary">No messages</p>
          </div>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => selectThread(thread.id, activeAccountId ?? undefined)}
              className={`w-full border-b border-border-secondary px-4 py-3 text-left transition-colors ${
                selectedThreadId === thread.id
                  ? "bg-bg-selected"
                  : "hover:bg-bg-hover"
              } ${!thread.is_read ? "bg-bg-secondary" : ""}`}
              data-testid={`thread-item-${thread.id}`}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={`truncate text-sm ${
                    !thread.is_read
                      ? "font-semibold text-text-primary"
                      : "text-text-primary"
                  }`}
                >
                  {thread.subject || "(No subject)"}
                </span>
                <span className="ml-2 shrink-0 text-xs text-text-tertiary">
                  {formatDate(thread.last_message_at)}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-text-secondary">
                {thread.snippet}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
