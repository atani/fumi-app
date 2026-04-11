import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, ChevronUp, Minus } from "lucide-react";
import { useComposerStore } from "../../stores/composerStore";
import { useAccountStore } from "../../stores/accountStore";
import { sendEmail } from "../../services/gmail/send";
import {
  startAutoSave,
  stopAutoSave,
  deleteDraft,
} from "../../services/composer/draftAutoSave";
import { AddressInput } from "./AddressInput";
import { AttachmentPicker } from "./AttachmentPicker";

export function Composer() {
  const {
    isOpen,
    mode,
    draftId,
    to,
    cc,
    bcc,
    subject,
    body,
    replyToMessage,
    inReplyTo,
    references,
    attachments,
    updateField,
    close,
  } = useComposerStore();
  const { getActiveAccount } = useAccountStore();

  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Focus body on open for reply/forward, to field for compose
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setError(null);
      // Show CC field if it has content (e.g., reply-all)
      if (cc) setShowCc(true);
    }
  }, [isOpen, isMinimized, cc]);

  // Reset minimized state when composer opens
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Auto-save lifecycle
  useEffect(() => {
    if (!isOpen) return;

    startAutoSave(
      () => getActiveAccount()?.id ?? null,
      () => {
        setDraftSaved(true);
        if (draftSavedTimerRef.current) clearTimeout(draftSavedTimerRef.current);
        draftSavedTimerRef.current = setTimeout(() => setDraftSaved(false), 2000);
      },
    );

    return () => {
      stopAutoSave();
      if (draftSavedTimerRef.current) {
        clearTimeout(draftSavedTimerRef.current);
        draftSavedTimerRef.current = null;
      }
      setDraftSaved(false);
    };
  }, [isOpen, getActiveAccount]);

  const handleSend = useCallback(async () => {
    const account = getActiveAccount();
    if (!account) {
      setError("No active account");
      return;
    }
    if (!to.trim()) {
      setError("Recipient is required");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await sendEmail(account, {
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject,
        body,
        inReplyTo,
        references,
        threadId: replyToMessage?.thread_id ?? null,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      if (draftId) {
        await deleteDraft(draftId).catch((err: unknown) => {
          console.error("Failed to delete draft after send:", err);
        });
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  }, [getActiveAccount, to, cc, bcc, subject, body, inReplyTo, references, replyToMessage, draftId, attachments, close]);

  // Ctrl+Enter to send
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!isOpen) return null;

  const modeLabel =
    mode === "compose"
      ? "New Message"
      : mode === "reply"
        ? "Reply"
        : mode === "replyAll"
          ? "Reply All"
          : "Forward";

  return (
    <div
      className="fixed right-6 bottom-0 z-50 flex w-[560px] flex-col rounded-t-xl border border-b-0 border-border-primary bg-bg-primary shadow-xl"
      data-testid="composer"
      onKeyDown={handleKeyDown}
    >
      {/* Title bar */}
      <div
        className="flex cursor-pointer items-center justify-between rounded-t-xl bg-bg-secondary px-4 py-2"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <span className="text-sm font-medium text-text-primary">
          {modeLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            aria-label={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
          </button>
          <button
            className="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="Close composer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      {!isMinimized && (
        <div className="flex flex-col">
          {/* To field */}
          <div className="flex items-center border-b border-border-secondary px-4 py-1.5">
            <label className="w-12 shrink-0 text-xs text-text-tertiary">
              To
            </label>
            <AddressInput
              value={to}
              onChange={(v) => updateField("to", v)}
              placeholder="recipient@example.com"
              autoFocus={mode === "compose"}
            />
            <div className="flex gap-1 text-xs text-text-tertiary">
              {!showCc && (
                <button
                  className="hover:text-text-primary"
                  onClick={() => setShowCc(true)}
                >
                  Cc
                </button>
              )}
              {!showBcc && (
                <button
                  className="hover:text-text-primary"
                  onClick={() => setShowBcc(true)}
                >
                  Bcc
                </button>
              )}
            </div>
          </div>

          {/* Cc field */}
          {showCc && (
            <div className="flex items-center border-b border-border-secondary px-4 py-1.5">
              <label className="w-12 shrink-0 text-xs text-text-tertiary">
                Cc
              </label>
              <AddressInput
                value={cc}
                onChange={(v) => updateField("cc", v)}
                placeholder=""
              />
              <button
                className="text-xs text-text-tertiary hover:text-text-primary"
                onClick={() => {
                  setShowCc(false);
                  updateField("cc", "");
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Bcc field */}
          {showBcc && (
            <div className="flex items-center border-b border-border-secondary px-4 py-1.5">
              <label className="w-12 shrink-0 text-xs text-text-tertiary">
                Bcc
              </label>
              <AddressInput
                value={bcc}
                onChange={(v) => updateField("bcc", v)}
                placeholder=""
              />
              <button
                className="text-xs text-text-tertiary hover:text-text-primary"
                onClick={() => {
                  setShowBcc(false);
                  updateField("bcc", "");
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Subject field */}
          <div className="flex items-center border-b border-border-secondary px-4 py-1.5">
            <label className="w-12 shrink-0 text-xs text-text-tertiary">
              Subject
            </label>
            <input
              type="text"
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
              value={subject}
              onChange={(e) => updateField("subject", e.target.value)}
            />
          </div>

          {/* Body */}
          <textarea
            ref={bodyRef}
            className="min-h-[200px] resize-none bg-transparent px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            placeholder="Write your message..."
            value={body}
            onChange={(e) => updateField("body", e.target.value)}
            autoFocus={mode !== "compose"}
          />

          {/* Attachments */}
          <div className="px-4">
            <AttachmentPicker />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 pb-2 text-xs text-red-500">{error}</div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border-secondary px-4 py-2">
            <button
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              onClick={handleSend}
              disabled={isSending}
            >
              <Send className="h-4 w-4" />
              {isSending ? "Sending..." : "Send"}
            </button>
            <span className="text-xs text-text-tertiary">
              {draftSaved && (
                <span className="mr-2 text-green-500" data-testid="draft-saved-indicator">
                  Draft saved
                </span>
              )}
              {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to
              send
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
