import { useEffect } from "react";
import { useThreadStore } from "../../stores/threadStore";
import { useAccountStore } from "../../stores/accountStore";
import { useComposerStore } from "../../stores/composerStore";
import { Reply, ReplyAll, Forward, Archive, Trash2, Star } from "lucide-react";
import { EmailRenderer } from "../email/EmailRenderer";
import {
  markAsRead,
  toggleStar,
  archiveThread,
  trashThread,
} from "../../services/emailActions";

export function ReadingPane() {
  const { threads, selectedThreadId, messages } = useThreadStore();
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);

  const account = accounts.find((a) => a.id === activeAccountId) ?? null;
  const thread = threads.find((t) => t.id === selectedThreadId) ?? null;

  // Auto-mark as read when a thread is selected
  useEffect(() => {
    if (account && thread && !thread.is_read) {
      void markAsRead(account, thread.id);
    }
  }, [account, thread?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onClick={handleTrash}
            title="Trash"
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-hover hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

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
    </div>
  );
}
