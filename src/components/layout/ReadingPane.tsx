import { useEffect, useState, useCallback } from "react";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { useComposerStore } from "../../stores/composerStore";
import { useLabelStore } from "../../stores/labelStore";
import { Reply, ReplyAll, Forward, Archive, Trash2, Star, Clock, Tag, X } from "lucide-react";
import { EmailRenderer } from "../email/EmailRenderer";
import { AttachmentList } from "../email/AttachmentList";
import { SnoozeDialog } from "../email/SnoozeDialog";
import { MoveToLabelDialog } from "../email/MoveToLabelDialog";
import {
  markAsRead,
  toggleStar,
  archiveThread,
  trashThread,
} from "../../services/emailActions";
import { snoozeThread } from "../../services/snooze/snoozeService";
import { getAttachmentsByThread } from "../../services/db/attachments";
import { getThreadLabelIds } from "../../services/db/labels";
import { removeLabelFromThread } from "../../services/gmail/labels";
import { getDb } from "../../services/db/connection";
import type { Attachment } from "../../types";

export function ReadingPane() {
  const { threads, selectedThreadId, messages } = useThreadStore();
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  const { userLabels } = useLabelStore();

  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [threadLabelIds, setThreadLabelIds] = useState<string[]>([]);
  const [attachmentMap, setAttachmentMap] = useState<Map<string, Attachment[]>>(
    new Map(),
  );

  const account = accounts.find((a) => a.id === activeAccountId) ?? null;
  const thread = threads.find((t) => t.id === selectedThreadId) ?? null;

  // Auto-mark as read when a thread is selected
  useEffect(() => {
    if (account && thread && !thread.is_read) {
      void markAsRead(account, thread.id);
    }
  }, [account, thread?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load attachments for all messages in the thread
  useEffect(() => {
    if (!activeAccountId || messages.length === 0) {
      setAttachmentMap(new Map());
      return;
    }
    const messageIds = messages.map((m) => m.id);
    void getAttachmentsByThread(activeAccountId, messageIds).then(
      setAttachmentMap,
    );
  }, [activeAccountId, messages]);

  // Load thread labels when thread changes
  useEffect(() => {
    if (selectedThreadId && activeAccountId) {
      void getThreadLabelIds(selectedThreadId, activeAccountId).then(
        setThreadLabelIds,
      );
    } else {
      setThreadLabelIds([]);
    }
  }, [selectedThreadId, activeAccountId]);

  // Listen for 'v' key to open move-to-label dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "v" && selectedThreadId && activeAccountId) {
        e.preventDefault();
        setIsMoveDialogOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedThreadId, activeAccountId]);

  const handleRemoveLabel = useCallback(
    async (labelId: string) => {
      if (!account || !selectedThreadId) return;
      try {
        const db = await getDb();
        await Promise.all([
          removeLabelFromThread(account, selectedThreadId, labelId),
          db.execute(
            "DELETE FROM thread_labels WHERE thread_id = $1 AND label_id = $2 AND account_id = $3",
            [selectedThreadId, labelId, account.id],
          ),
        ]);
        setThreadLabelIds((prev) => prev.filter((id) => id !== labelId));
      } catch (err) {
        console.error("Failed to remove label:", err);
      }
    },
    [account, selectedThreadId],
  );

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg-primary">
        <p className="text-text-tertiary">Loading messages...</p>
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];

  const handleArchive = () => {
    if (account && thread) {
      void archiveThread(account, thread.id);
    }
  };

  const handleStar = () => {
    if (account && thread) {
      void toggleStar(account, thread.id, thread.is_starred);
    }
  };

  const handleTrash = () => {
    if (account && thread) {
      void trashThread(account, thread.id);
    }
  };

  const handleSnooze = (until: string) => {
    if (account && thread) {
      void snoozeThread(account, thread.id, until);
    }
  };

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden bg-bg-primary"
      data-testid="reading-pane"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary px-6 py-3">
        <h2 className="text-lg font-semibold text-text-primary">
          {lastMessage?.subject || "(No subject)"}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMoveDialogOpen(true)}
            title="Apply labels (v)"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            data-testid="move-to-label-btn"
          >
            <Tag className="h-4 w-4" />
          </button>
          <button
            onClick={handleArchive}
            title="Archive"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={handleStar}
            title={thread?.is_starred ? "Unstar" : "Star"}
            className={`rounded-lg p-2 hover:bg-bg-hover ${
              thread?.is_starred
                ? "text-yellow-500"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Star
              className="h-4 w-4"
              fill={thread?.is_starred ? "currentColor" : "none"}
            />
          </button>
          <button
            onClick={() => setIsSnoozeOpen(true)}
            title="Snooze"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <Clock className="h-4 w-4" />
          </button>
          <button
            onClick={handleTrash}
            title="Trash"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Label chips */}
      {(() => {
        const appliedUserLabels = userLabels.filter((l) =>
          threadLabelIds.includes(l.id),
        );
        if (appliedUserLabels.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1.5 border-b border-border-secondary px-6 py-2">
            {appliedUserLabels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={
                  label.color
                    ? {
                        backgroundColor: `${label.color}20`,
                        color: label.color,
                      }
                    : undefined
                }
                data-testid={`label-chip-${label.id}`}
              >
                {label.color && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                )}
                {label.name}
                <button
                  onClick={() => void handleRemoveLabel(label.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                  title={`Remove ${label.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        );
      })()}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className="border-b border-border-secondary px-6 py-4"
            data-testid={`message-${message.id}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-text-primary">
                  {message.from_name || message.from_address}
                </span>
                {message.from_name && (
                  <span className="ml-2 text-sm text-text-tertiary">
                    &lt;{message.from_address}&gt;
                  </span>
                )}
              </div>
              <span className="text-xs text-text-tertiary">
                {message.date
                  ? new Date(message.date).toLocaleString()
                  : ""}
              </span>
            </div>

            <div className="mt-1 text-xs text-text-secondary">
              To: {message.to_addresses}
            </div>

            <div className="mt-4 text-sm text-text-primary">
              <EmailRenderer
                html={message.body_html}
                text={message.body_text ?? message.snippet}
              />
            </div>

            {account && (attachmentMap.get(message.id)?.length ?? 0) > 0 && (
              <AttachmentList
                attachments={attachmentMap.get(message.id)!}
                account={account}
              />
            )}
          </div>
        ))}
      </div>

      {/* Quick reply actions */}
      <div className="flex gap-2 border-t border-border-primary px-6 py-3">
        <button
          onClick={() => {
            if (lastMessage) useComposerStore.getState().openReply(lastMessage);
          }}
          className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <Reply className="h-4 w-4" /> Reply
        </button>
        <button
          onClick={() => {
            if (lastMessage && account) {
              useComposerStore.getState().openReplyAll(lastMessage, account.email);
            }
          }}
          className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <ReplyAll className="h-4 w-4" /> Reply All
        </button>
        <button
          onClick={() => {
            if (lastMessage) useComposerStore.getState().openForward(lastMessage);
          }}
          className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <Forward className="h-4 w-4" /> Forward
        </button>
      </div>

      <SnoozeDialog
        isOpen={isSnoozeOpen}
        onClose={() => setIsSnoozeOpen(false)}
        onSnooze={handleSnooze}
      />

      {selectedThreadId && activeAccountId && (
        <MoveToLabelDialog
          isOpen={isMoveDialogOpen}
          onClose={() => {
            setIsMoveDialogOpen(false);
            // Refresh label IDs after dialog closes
            if (selectedThreadId && activeAccountId) {
              void getThreadLabelIds(selectedThreadId, activeAccountId).then(
                setThreadLabelIds,
              );
            }
          }}
          threadId={selectedThreadId}
          accountId={activeAccountId}
        />
      )}
    </div>
  );
}
