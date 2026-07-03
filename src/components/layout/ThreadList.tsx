import { useCallback, useMemo, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { useUIStore } from "../../stores/uiStore";
import { useContextMenuStore } from "../../stores/contextMenuStore";
import { CategoryTabs } from "../email/CategoryTabs";
import { MoveToLabelDialog } from "../email/MoveToLabelDialog";
import {
  RefreshCw,
  Star,
  Search,
  Archive,
  Trash2,
  Mail,
  MailOpen,
  Tag,
  X,
  PanelRight,
  Rows2,
  EyeOff,
  Reply,
  Forward,
  Clock,
  VolumeX,
} from "lucide-react";
import type { ReadingPanePosition } from "../../stores/uiStore";
import {
  archiveThread,
  trashThread,
  toggleStar,
  muteThread,
  archiveThreads,
  trashThreads,
  markThreadsAsRead,
  markThreadsAsUnread,
} from "../../services/emailActions";
import type { Thread } from "../../types";
import { EmptyState } from "../ui/EmptyState";
import { InboxClearIllustration } from "../ui/illustrations";

type EmailDensity = "compact" | "default" | "comfortable";

const DENSITY_CLASSES: Record<EmailDensity, { container: string; subject: string; snippet: string }> = {
  compact: { container: "py-1.5", subject: "text-xs", snippet: "text-xs" },
  default: { container: "py-3", subject: "text-sm", snippet: "text-xs" },
  comfortable: { container: "py-4", subject: "text-base", snippet: "text-sm" },
};

interface DraggableThreadItemProps {
  thread: Thread;
  isActive: boolean;
  isSelected: boolean;
  isMultiSelect: boolean;
  isRead: boolean;
  density: EmailDensity;
  formatDate: (dateStr: string | null) => string;
  onClick: (e: React.MouseEvent, threadId: string) => void;
  onDoubleClick?: (e: React.MouseEvent, threadId: string) => void;
  onCheckboxClick: (e: React.MouseEvent, threadId: string) => void;
  onContextMenu: (e: React.MouseEvent, threadId: string) => void;
}

/** Formats a thread date as a time (today) or short date. Module-level so the
 * reference is stable and doesn't defeat the memoized row below. */
function formatThreadDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const DraggableThreadItem = memo(function DraggableThreadItem({
  thread,
  isActive,
  isSelected,
  isMultiSelect,
  isRead,
  density,
  formatDate,
  onClick,
  onDoubleClick,
  onCheckboxClick,
  onContextMenu,
}: DraggableThreadItemProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: thread.id,
  });

  const densityStyle = DENSITY_CLASSES[density];

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => onClick(e, thread.id)}
      onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, thread.id) : undefined}
      onContextMenu={(e) => onContextMenu(e, thread.id)}
      className={`group w-full border-b border-border-secondary px-4 ${densityStyle.container} text-left transition-colors ${
        isActive
          ? "bg-bg-selected"
          : isSelected
            ? "bg-accent-light"
            : "hover:bg-bg-hover"
      } ${!isRead ? "bg-bg-secondary" : ""} ${isDragging ? "opacity-50" : ""}`}
      data-testid={`thread-item-${thread.id}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`shrink-0 ${isMultiSelect ? "block" : "hidden group-hover:block"}`}
            onClick={(e) => onCheckboxClick(e, thread.id)}
            role="checkbox"
            aria-checked={isSelected}
            data-testid={`thread-checkbox-${thread.id}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              className="pointer-events-none h-3.5 w-3.5 rounded border-border-primary accent-accent"
              tabIndex={-1}
            />
          </span>
          {!isRead && !isMultiSelect && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent group-hover:hidden" />
          )}
          <span
            className={`truncate ${densityStyle.subject} ${
              !isRead
                ? "font-semibold text-text-primary"
                : "text-text-primary"
            }`}
          >
            {thread.subject || t("layout.noSubject")}
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
        className={`mt-1 truncate ${densityStyle.snippet} ${
          !isRead
            ? "font-medium text-text-secondary"
            : "text-text-secondary"
        }`}
      >
        {thread.snippet}
      </p>
    </button>
  );
});

interface ThreadListProps {
  onOpenSearch?: () => void;
}

export function ThreadList({ onOpenSearch }: ThreadListProps) {
  const {
    threads,
    selectedThreadId,
    selectedThreadIds,
    lastSelectedThreadId,
    selectThread,
    toggleSelectThread,
    selectRange,
    clearSelection,
    isLoading,
    isSyncing,
    activeLabel,
    activeCategory,
    categoryMap,
  } = useThreadStore();
  const { activeAccountId } = useAccountStore();
  const { emailDensity, readingPanePosition, setReadingPanePosition, emailListWidth } = useUIStore();
  const { t } = useTranslation();

  const isInbox = activeLabel === "INBOX";
  const isMultiSelect = selectedThreadIds.size > 0;
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);

  const filteredThreads = useMemo(() => {
    if (!isInbox || activeCategory === null) return threads;
    return threads.filter((t) => categoryMap[t.id] === activeCategory);
  }, [threads, isInbox, activeCategory, categoryMap]);

  const handleThreadClick = useCallback(
    (e: React.MouseEvent, threadId: string) => {
      if (e.shiftKey && lastSelectedThreadId) {
        e.preventDefault();
        selectRange(lastSelectedThreadId, threadId);
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        toggleSelectThread(threadId);
      } else if (isMultiSelect) {
        toggleSelectThread(threadId);
      } else {
        void selectThread(threadId, activeAccountId ?? undefined);
      }
    },
    [lastSelectedThreadId, selectRange, toggleSelectThread, isMultiSelect, selectThread, activeAccountId],
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, threadId: string) => {
      e.stopPropagation();
      if (e.shiftKey && lastSelectedThreadId) {
        selectRange(lastSelectedThreadId, threadId);
      } else {
        toggleSelectThread(threadId);
      }
    },
    [lastSelectedThreadId, selectRange, toggleSelectThread],
  );

  const showContextMenu = useContextMenuStore((s) => s.show);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, threadId: string) => {
      e.preventDefault();
      const account = useAccountStore.getState().getActiveAccount();
      if (!account) return;

      const thread = threads.find((t) => t.id === threadId);

      showContextMenu(e.clientX, e.clientY, [
        {
          label: t("layout.reply"),
          icon: Reply,
          onClick: () => {
            void selectThread(threadId, account.id);
            // Reply is handled via the thread view once selected
          },
        },
        {
          label: t("layout.forward"),
          icon: Forward,
          onClick: () => {
            void selectThread(threadId, account.id);
            // Forward is handled via the thread view once selected
          },
        },
        {
          label: t("layout.archive"),
          icon: Archive,
          separator: true,
          onClick: () => void archiveThread(account, threadId),
        },
        {
          label: t("layout.trash"),
          icon: Trash2,
          onClick: () => void trashThread(account, threadId),
        },
        {
          label: thread?.is_starred ? t("layout.unstar") : t("layout.star"),
          icon: Star,
          separator: true,
          onClick: () => void toggleStar(account, threadId, !thread?.is_starred),
        },
        {
          label: t("layout.label"),
          icon: Tag,
          onClick: () => {
            void selectThread(threadId, account.id);
            window.dispatchEvent(new CustomEvent("velo-move-to-folder"));
          },
        },
        {
          label: t("layout.snooze"),
          icon: Clock,
          onClick: () => {
            void selectThread(threadId, account.id);
            // Snooze dialog is triggered via the thread view
          },
        },
        {
          label: thread?.is_muted ? t("layout.unmute") : t("layout.mute"),
          icon: VolumeX,
          onClick: () => void muteThread(account, threadId),
        },
      ]);
    },
    [threads, showContextMenu, selectThread, t],
  );

  const handleThreadDoubleClick = useCallback(
    (_e: React.MouseEvent, threadId: string) => {
      if (readingPanePosition === "hidden") {
        void selectThread(threadId, activeAccountId ?? undefined);
      }
    },
    [readingPanePosition, selectThread, activeAccountId],
  );

  const cycleReadingPanePosition = useCallback(() => {
    const positions: ReadingPanePosition[] = ["right", "bottom", "hidden"];
    const currentIndex = positions.indexOf(readingPanePosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    const next = positions[nextIndex];
    if (next) {
      setReadingPanePosition(next);
    }
  }, [readingPanePosition, setReadingPanePosition]);

  const readingPaneIcon = readingPanePosition === "right"
    ? PanelRight
    : readingPanePosition === "bottom"
      ? Rows2
      : EyeOff;

  const readingPaneLabel = readingPanePosition === "right"
    ? t("layout.readingPaneRight")
    : readingPanePosition === "bottom"
      ? t("layout.readingPaneBottom")
      : t("layout.readingPaneHidden");

  const handleBulkArchive = useCallback(async () => {
    const account = useAccountStore.getState().getActiveAccount();
    if (!account) return;
    const ids = Array.from(selectedThreadIds);
    clearSelection();
    await archiveThreads(account, ids);
  }, [selectedThreadIds, clearSelection]);

  const handleBulkTrash = useCallback(async () => {
    const account = useAccountStore.getState().getActiveAccount();
    if (!account) return;
    const ids = Array.from(selectedThreadIds);
    clearSelection();
    await trashThreads(account, ids);
  }, [selectedThreadIds, clearSelection]);

  const handleBulkMarkRead = useCallback(async () => {
    const account = useAccountStore.getState().getActiveAccount();
    if (!account) return;
    await markThreadsAsRead(account, Array.from(selectedThreadIds));
  }, [selectedThreadIds]);

  const handleBulkMarkUnread = useCallback(async () => {
    const account = useAccountStore.getState().getActiveAccount();
    if (!account) return;
    await markThreadsAsUnread(account, Array.from(selectedThreadIds));
  }, [selectedThreadIds]);

  const threadListClasses = readingPanePosition === "right"
    ? "flex shrink-0 flex-col border-r border-border-primary bg-bg-primary"
    : readingPanePosition === "bottom"
      ? "flex flex-col border-b border-border-primary bg-bg-primary h-1/2"
      : "flex flex-1 flex-col bg-bg-primary";

  return (
    <div
      className={threadListClasses}
      style={readingPanePosition === "right" ? { width: emailListWidth } : undefined}
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
            aria-label={t("layout.searchEmails")}
            data-testid="search-button"
          >
            <Search className="h-4 w-4" />
          </button>
          {(() => {
            const Icon = readingPaneIcon;
            return (
              <button
                onClick={cycleReadingPanePosition}
                className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
                aria-label={readingPaneLabel}
                title={readingPaneLabel}
                data-testid="reading-pane-toggle"
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })()}
          {isSyncing && (
            <RefreshCw className="h-4 w-4 animate-spin text-text-tertiary" />
          )}
        </div>
      </div>

      {isMultiSelect && (
        <div
          className="flex items-center gap-1 border-b border-border-primary bg-bg-secondary px-3 py-2"
          data-testid="bulk-action-bar"
        >
          <span className="mr-2 text-xs font-medium text-text-secondary">
            {t("layout.selectedCount", { count: selectedThreadIds.size })}
          </span>
          <button
            onClick={() => void handleBulkArchive()}
            className="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("layout.archiveSelected")}
            title={t("layout.archiveSelected")}
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleBulkTrash()}
            className="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("layout.trashSelected")}
            title={t("layout.trashSelected")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleBulkMarkRead()}
            className="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("layout.markSelectedRead")}
            title={t("layout.markRead")}
          >
            <MailOpen className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleBulkMarkUnread()}
            className="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("layout.markSelectedUnread")}
            title={t("layout.markUnread")}
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsBulkMoveOpen(true)}
            className="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("layout.labelSelected")}
            title={t("layout.moveToLabel")}
            data-testid="bulk-move-to-label"
          >
            <Tag className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          <button
            onClick={clearSelection}
            className="rounded p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("layout.clearSelection")}
            title={t("layout.clearSelection")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isInbox && <CategoryTabs />}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-text-tertiary">{t("layout.loading")}</p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <EmptyState
            illustration={<InboxClearIllustration />}
            title={t("layout.allClear")}
            description={t("layout.noMessages")}
          />
        ) : (
          filteredThreads.map((thread) => (
            <DraggableThreadItem
              key={thread.id}
              thread={thread}
              isActive={selectedThreadId === thread.id}
              isSelected={selectedThreadIds.has(thread.id)}
              isMultiSelect={isMultiSelect}
              isRead={thread.is_read}
              density={emailDensity}
              formatDate={formatThreadDate}
              onClick={handleThreadClick}
              onDoubleClick={readingPanePosition === "hidden" ? handleThreadDoubleClick : undefined}
              onCheckboxClick={handleCheckboxClick}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {activeAccountId && (
        <MoveToLabelDialog
          isOpen={isBulkMoveOpen}
          onClose={() => {
            setIsBulkMoveOpen(false);
            clearSelection();
          }}
          accountId={activeAccountId}
          threadIds={Array.from(selectedThreadIds)}
        />
      )}
    </div>
  );
}
