import { useEffect, useState, useCallback } from "react";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { useComposerStore } from "../../stores/composerStore";
import { useLabelStore } from "../../stores/labelStore";
import { Reply, ReplyAll, Forward, Archive, Trash2, Star, Clock, Tag, X, ExternalLink, BellRing, VolumeX, Volume2, User, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { ThreadSummary } from "../email/ThreadSummary";
import { SmartReplySuggestions } from "../email/SmartReplySuggestions";
import { MessageItem } from "../email/MessageItem";
import { SnoozeDialog } from "../email/SnoozeDialog";
import { FollowUpDialog } from "../email/FollowUpDialog";
import { MoveToLabelDialog } from "../email/MoveToLabelDialog";
import { ContactSidebar } from "../email/ContactSidebar";
import {
  markAsRead,
  toggleStar,
  archiveThread,
  trashThread,
  muteThread,
  unmuteThread,
} from "../../services/emailActions";
import { snoozeThread } from "../../services/snooze/snoozeService";
import { addFollowUp } from "../../services/followup/followupManager";
import { openThreadWindow } from "../../services/windowManager";
import { generateAutoReply } from "../../services/ai/writingStyleService";
import { getAttachmentsByThread } from "../../services/db/attachments";
import { getThreadLabelIds } from "../../services/db/labels";
import { removeLabelFromThread } from "../../services/gmail/labels";
import { getDb } from "../../services/db/connection";
import type { Attachment } from "../../types";

interface ReadingPaneProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ReadingPane({ onBack, showBackButton }: ReadingPaneProps = {}) {
  const { threads, selectedThreadId, messages } = useThreadStore();
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  const { userLabels } = useLabelStore();

  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [threadLabelIds, setThreadLabelIds] = useState<string[]>([]);
  const [attachmentMap, setAttachmentMap] = useState<Map<string, Attachment[]>>(
    new Map(),
  );
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const [markAsReadBehavior, setMarkAsReadBehavior] = useState<string>("immediately");
  const [defaultReplyMode, setDefaultReplyMode] = useState<string>("reply");
  const [isContactSidebarOpen, setIsContactSidebarOpen] = useState(false);
  const [isAutoDrafting, setIsAutoDrafting] = useState(false);

  const account = accounts.find((a) => a.id === activeAccountId) ?? null;
  const thread = threads.find((t) => t.id === selectedThreadId) ?? null;

  // Load email behavior settings
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const db = await getDb();
        const [markReadRows, replyRows] = await Promise.all([
          db.select<{ value: string }[]>(
            "SELECT value FROM settings WHERE key = $1",
            ["mark_as_read_behavior"],
          ),
          db.select<{ value: string }[]>(
            "SELECT value FROM settings WHERE key = $1",
            ["default_reply_mode"],
          ),
        ]);
        if (!cancelled) {
          if (markReadRows[0]?.value) setMarkAsReadBehavior(markReadRows[0].value);
          if (replyRows[0]?.value) setDefaultReplyMode(replyRows[0].value);
        }
      } catch {
        // Use defaults
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Default expand state: only the last message is expanded
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        setExpandedMessageIds(new Set([lastMsg.id]));
      }
    } else {
      setExpandedMessageIds(new Set());
    }
  }, [messages]);

  const toggleMessage = useCallback((messageId: string) => {
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // Auto-mark as read when a thread is selected
  useEffect(() => {
    if (!account || !thread || thread.is_read) return;
    if (markAsReadBehavior === "manually") return;

    const threadId = thread.id;

    if (markAsReadBehavior === "after_2s") {
      const timer = setTimeout(() => {
        void markAsRead(account, threadId);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // "immediately" (default)
    void markAsRead(account, threadId);
  }, [account, thread?.id, thread?.is_read, markAsReadBehavior]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Derive sender info from the first message for the contact sidebar
  const senderEmail = messages[0]?.from_address ?? null;
  const senderName = messages[0]?.from_name ?? null;

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

  const handleFollowUp = (hours: number) => {
    if (account && thread) {
      void addFollowUp(thread.id, account.id, hours);
    }
  };

  const handleMuteToggle = () => {
    if (account && thread) {
      if (thread.is_muted) {
        void unmuteThread(account, thread.id);
      } else {
        void muteThread(account, thread.id);
      }
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden" data-testid="reading-pane">
    <div
      className="flex flex-1 min-w-0 flex-col overflow-hidden bg-bg-primary"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="shrink-0 rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              aria-label="Back to thread list"
              data-testid="reading-pane-back-btn"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="truncate text-lg font-semibold text-text-primary">
            {lastMessage?.subject || "(No subject)"}
          </h2>
          {selectedThreadId && activeAccountId && (
            <ThreadSummary
              messages={messages}
              threadId={selectedThreadId}
              accountId={activeAccountId}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsContactSidebarOpen((prev) => !prev)}
            title={isContactSidebarOpen ? "Hide contact info" : "Show contact info"}
            className={`rounded-lg p-2 hover:bg-bg-hover ${
              isContactSidebarOpen
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid="contact-sidebar-toggle"
          >
            <User className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (selectedThreadId && activeAccountId) {
                void openThreadWindow(selectedThreadId, activeAccountId);
              }
            }}
            title="Pop out"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            data-testid="pop-out-btn"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
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
            onClick={() => setIsFollowUpOpen(true)}
            title="Follow up"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            data-testid="follow-up-btn"
          >
            <BellRing className="h-4 w-4" />
          </button>
          <button
            onClick={handleMuteToggle}
            title={thread?.is_muted ? "Unmute (m)" : "Mute (m)"}
            className={`rounded-lg p-2 hover:bg-bg-hover ${
              thread?.is_muted
                ? "text-warning"
                : "text-text-secondary hover:text-text-primary"
            }`}
            data-testid="mute-btn"
          >
            {thread?.is_muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
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
          <MessageItem
            key={message.id}
            message={message}
            isExpanded={expandedMessageIds.has(message.id)}
            onToggle={() => toggleMessage(message.id)}
            account={account}
            attachments={attachmentMap.get(message.id) ?? []}
          />
        ))}
      </div>

      {/* Smart reply suggestions */}
      {selectedThreadId && activeAccountId && (
        <div className="border-t border-border-secondary px-6 py-2">
          <SmartReplySuggestions
            messages={messages}
            threadId={selectedThreadId}
            accountId={activeAccountId}
          />
        </div>
      )}

      {/* Quick reply actions */}
      <div className="flex gap-2 border-t border-border-primary px-6 py-3">
        {defaultReplyMode === "reply_all" ? (
          <>
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
                if (lastMessage) useComposerStore.getState().openReply(lastMessage);
              }}
              className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              <Reply className="h-4 w-4" /> Reply
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
        <button
          onClick={() => {
            if (lastMessage) useComposerStore.getState().openForward(lastMessage);
          }}
          className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <Forward className="h-4 w-4" /> Forward
        </button>
        <button
          onClick={() => {
            if (!account || !lastMessage || messages.length === 0) return;
            setIsAutoDrafting(true);
            void generateAutoReply(account, messages)
              .then((draft) => {
                useComposerStore.getState().openReply(lastMessage);
                useComposerStore.getState().updateField("body", draft);
              })
              .catch((err) => {
                console.error("Auto-draft failed:", err);
              })
              .finally(() => {
                setIsAutoDrafting(false);
              });
          }}
          disabled={isAutoDrafting}
          className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
          data-testid="auto-draft-btn"
          title="Auto-draft reply using AI"
        >
          {isAutoDrafting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Auto-draft
        </button>
      </div>

      <SnoozeDialog
        isOpen={isSnoozeOpen}
        onClose={() => setIsSnoozeOpen(false)}
        onSnooze={handleSnooze}
      />

      <FollowUpDialog
        isOpen={isFollowUpOpen}
        onClose={() => setIsFollowUpOpen(false)}
        onSetFollowUp={handleFollowUp}
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

    {/* Contact sidebar */}
    {isContactSidebarOpen && senderEmail && activeAccountId && (
      <ContactSidebar
        email={senderEmail}
        name={senderName}
        accountId={activeAccountId}
        onClose={() => setIsContactSidebarOpen(false)}
      />
    )}
    </div>
  );
}
