import { useEffect, useState, useCallback } from "react";
import {
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Star,
} from "lucide-react";
import { EmailRenderer } from "./EmailRenderer";
import { AttachmentList } from "./AttachmentList";
import { getMessagesByThread } from "../../services/db/messages";
import { getAttachmentsByThread } from "../../services/db/attachments";
import { getAccount } from "../../services/db/accounts";
import {
  markAsRead,
  toggleStar,
  archiveThread,
  trashThread,
} from "../../services/emailActions";
import { useComposerStore } from "../../stores/composerStore";
import type { Message, Account, Attachment } from "../../types";

interface ThreadWindowProps {
  threadId: string;
  accountId: string;
}

export function ThreadWindow({ threadId, accountId }: ThreadWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [isStarred, setIsStarred] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [attachmentMap, setAttachmentMap] = useState<
    Map<string, Attachment[]>
  >(new Map());

  // Load account and messages on mount
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [acct, msgs] = await Promise.all([
          getAccount(accountId),
          getMessagesByThread(accountId, threadId),
        ]);
        setAccount(acct);
        setMessages(msgs);

        // Mark as read
        if (acct && msgs.some((m) => !m.is_read)) {
          void markAsRead(acct, threadId);
        }

        // Load attachments
        if (msgs.length > 0) {
          const messageIds = msgs.map((m) => m.id);
          const atts = await getAttachmentsByThread(accountId, messageIds);
          setAttachmentMap(atts);
        }
      } catch (err) {
        console.error("Failed to load thread window data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [threadId, accountId]);

  const handleArchive = useCallback(() => {
    if (account) void archiveThread(account, threadId);
  }, [account, threadId]);

  const handleStar = useCallback(() => {
    if (account) {
      void toggleStar(account, threadId, isStarred);
      setIsStarred((prev) => !prev);
    }
  }, [account, threadId, isStarred]);

  const handleTrash = useCallback(() => {
    if (account) void trashThread(account, threadId);
  }, [account, threadId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <p className="text-text-tertiary">Loading thread...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <p className="text-text-tertiary">Thread not found</p>
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary px-6 py-3">
        <h2 className="truncate text-lg font-semibold text-text-primary">
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
            title={isStarred ? "Unstar" : "Star"}
            className={`rounded-lg p-2 hover:bg-bg-hover ${
              isStarred
                ? "text-yellow-500"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Star
              className="h-4 w-4"
              fill={isStarred ? "currentColor" : "none"}
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

            {account &&
              (attachmentMap.get(message.id)?.length ?? 0) > 0 && (
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
              useComposerStore
                .getState()
                .openReplyAll(lastMessage, account.email);
            }
          }}
          className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <ReplyAll className="h-4 w-4" /> Reply All
        </button>
        <button
          onClick={() => {
            if (lastMessage) {
              useComposerStore.getState().openForward(lastMessage);
            }
          }}
          className="flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >
          <Forward className="h-4 w-4" /> Forward
        </button>
      </div>
    </div>
  );
}
