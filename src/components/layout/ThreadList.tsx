import { useMemo } from "react";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { CategoryTabs } from "../email/CategoryTabs";
import { RefreshCw, Star, Search } from "lucide-react";

interface ThreadListProps {
  onOpenSearch?: () => void;
}

export function ThreadList({ onOpenSearch }: ThreadListProps) {
  const {
    threads,
    selectedThreadId,
    selectThread,
    isLoading,
    isSyncing,
    activeLabel,
    activeCategory,
    categoryMap,
  } = useThreadStore();
  const { activeAccountId } = useAccountStore();

  const isInbox = activeLabel === "INBOX";

  const filteredThreads = useMemo(() => {
    if (!isInbox || activeCategory === null) return threads;
    return threads.filter((t) => categoryMap[t.id] === activeCategory);
  }, [threads, isInbox, activeCategory, categoryMap]);

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
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
            aria-label="Search emails"
            data-testid="search-button"
          >
            <Search className="h-4 w-4" />
          </button>
          {isSyncing && (
            <RefreshCw className="h-4 w-4 animate-spin text-text-tertiary" />
          )}
        </div>
      </div>

      {isInbox && <CategoryTabs />}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-text-tertiary">Loading...</p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-text-tertiary">No messages</p>
          </div>
        ) : (
          filteredThreads.map((thread) => (
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
                <div className="flex min-w-0 items-center gap-1.5">
                  {!thread.is_read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                  <span
                    className={`truncate text-sm ${
                      !thread.is_read
                        ? "font-semibold text-text-primary"
                        : "text-text-primary"
                    }`}
                  >
                    {thread.subject || "(No subject)"}
                  </span>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-1">
                  {thread.is_starred && (
                    <Star
                      className="h-3 w-3 text-yellow-500"
                      fill="currentColor"
                    />
                  )}
                  <span className="text-xs text-text-tertiary">
                    {formatDate(thread.last_message_at)}
                  </span>
                </div>
              </div>
              <p
                className={`mt-1 truncate text-xs ${
                  !thread.is_read
                    ? "font-medium text-text-secondary"
                    : "text-text-secondary"
                }`}
              >
                {thread.snippet}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
