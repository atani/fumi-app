import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send, X, ChevronUp, Minus, ChevronDown } from "lucide-react";
import { useComposerStore } from "../../stores/composerStore";
import { useAccountStore } from "../../stores/accountStore";
import { sendEmail } from "../../services/gmail/send";
import { archiveThread } from "../../services/emailActions";
import { scheduleSend } from "../../services/gmail/scheduledSend";
import type { ScheduledSend } from "../../services/gmail/scheduledSend";
import {
  startAutoSave,
  stopAutoSave,
  deleteDraft,
} from "../../services/composer/draftAutoSave";
import { getDb } from "../../services/db/connection";
import { AddressInput } from "./AddressInput";
import { AttachmentPicker } from "./AttachmentPicker";
import { TemplatePicker } from "./TemplatePicker";
import { SignatureSelector } from "./SignatureSelector";
import { UndoSendToast } from "./UndoSendToast";
import { ScheduleSendDialog } from "./ScheduleSendDialog";
import { createScheduledEmail } from "../../services/db/scheduledEmails";
import { FromSelector } from "./FromSelector";

export function Composer() {
  const { t } = useTranslation();
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

  const [fromAddress, setFromAddress] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [undoSendDelayMs, setUndoSendDelayMs] = useState(0);
  const [sendAndArchiveEnabled, setSendAndArchiveEnabled] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const scheduledSendRef = useRef<ScheduledSend | null>(null);
  const undoSnapshotRef = useRef<{
    mode: typeof mode;
    draftId: typeof draftId;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    inReplyTo: typeof inReplyTo;
    references: typeof references;
  } | null>(null);
  const draftSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Load undo send delay and send & archive settings
  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const db = await getDb();
        const [delayRows, archiveRows] = await Promise.all([
          db.select<{ value: string }[]>(
            "SELECT value FROM settings WHERE key = $1",
            ["undo_send_delay"],
          ),
          db.select<{ value: string }[]>(
            "SELECT value FROM settings WHERE key = $1",
            ["send_and_archive"],
          ),
        ]);
        if (!cancelled) {
          if (delayRows[0]?.value) {
            setUndoSendDelayMs(Number(delayRows[0].value) * 1000);
          }
          if (archiveRows[0]?.value) {
            setSendAndArchiveEnabled(archiveRows[0].value === "true");
          }
        }
      } catch {
        // Use defaults
      }
    };
    loadSettings();
    return () => { cancelled = true; };
  }, []);

  // Focus body on open for reply/forward, to field for compose
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setError(null);
      // Show CC field if it has content (e.g., reply-all)
      if (cc) setShowCc(true);
    }
  }, [isOpen, isMinimized, cc]);

  // Reset minimized state and initialize from address when composer opens
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      const account = getActiveAccount();
      if (account) {
        setFromAddress(account.email);
      }
    }
  }, [isOpen, getActiveAccount]);

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

  const handleUndoSend = useCallback(() => {
    scheduledSendRef.current?.cancel();
    scheduledSendRef.current = null;
    setShowUndoToast(false);

    // Restore composer state from snapshot
    const snap = undoSnapshotRef.current;
    if (snap) {
      useComposerStore.setState({
        isOpen: true,
        mode: snap.mode,
        draftId: snap.draftId,
        to: snap.to,
        cc: snap.cc,
        bcc: snap.bcc,
        subject: snap.subject,
        body: snap.body,
        inReplyTo: snap.inReplyTo,
        references: snap.references,
      });
      undoSnapshotRef.current = null;
    }
  }, []);

  const handleUndoToastDismiss = useCallback(() => {
    setShowUndoToast(false);
    scheduledSendRef.current = null;
    undoSnapshotRef.current = null;
  }, []);

  const handleSend = useCallback(async () => {
    const account = getActiveAccount();
    if (!account) {
      setError(t("composer.noActiveAccount"));
      return;
    }
    if (!to.trim()) {
      setError(t("composer.recipientRequired"));
      return;
    }

    setIsSending(true);
    setError(null);

    const emailOptions = {
      to: to.trim(),
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      subject,
      body,
      from: fromAddress || undefined,
      inReplyTo,
      references,
      threadId: replyToMessage?.thread_id ?? null,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    if (undoSendDelayMs > 0) {
      // Save snapshot for undo restore
      undoSnapshotRef.current = {
        mode,
        draftId,
        to,
        cc,
        bcc,
        subject,
        body,
        inReplyTo,
        references,
      };

      const scheduled = scheduleSend(account, emailOptions, undoSendDelayMs);
      scheduledSendRef.current = scheduled;

      // Close composer and show undo toast
      close();
      setIsSending(false);
      setShowUndoToast(true);

      // Capture thread ID for archive after send
      const threadIdForArchive = replyToMessage?.thread_id ?? null;

      // Handle send completion in background
      scheduled.promise
        .then(async () => {
          if (draftId) {
            await deleteDraft(draftId).catch((err: unknown) => {
              console.error("Failed to delete draft after send:", err);
            });
          }
          if (sendAndArchiveEnabled && threadIdForArchive) {
            await archiveThread(account, threadIdForArchive).catch((err: unknown) => {
              console.error("Failed to archive thread after send:", err);
            });
          }
        })
        .catch((err: unknown) => {
          // "Send cancelled" is expected on undo — ignore it
          if (err instanceof Error && err.message === "Send cancelled") return;
          setError(err instanceof Error ? err.message : t("composer.failedToSend"));
        });
    } else {
      // Send immediately (no undo delay)
      try {
        await sendEmail(account, emailOptions);
        if (draftId) {
          await deleteDraft(draftId).catch((err: unknown) => {
            console.error("Failed to delete draft after send:", err);
          });
        }
        if (sendAndArchiveEnabled && replyToMessage?.thread_id) {
          await archiveThread(account, replyToMessage.thread_id).catch((err: unknown) => {
            console.error("Failed to archive thread after send:", err);
          });
        }
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("composer.failedToSend"));
      } finally {
        setIsSending(false);
      }
    }
  }, [getActiveAccount, to, cc, bcc, subject, body, fromAddress, inReplyTo, references, replyToMessage, draftId, attachments, close, mode, undoSendDelayMs, sendAndArchiveEnabled, t]);


  const handleScheduleSend = useCallback(async (scheduledDate: Date) => {
    const account = getActiveAccount();
    if (!account) {
      setError(t("composer.noActiveAccount"));
      return;
    }
    if (!to.trim()) {
      setError(t("composer.recipientRequired"));
      return;
    }

    setError(null);
    setShowScheduleDialog(false);

    try {
      const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await createScheduledEmail({
        id,
        account_id: account.id,
        to_addresses: to.trim(),
        cc: cc.trim() || null,
        bcc: bcc.trim() || null,
        subject,
        body,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        scheduled_at: scheduledDate.toISOString(),
      });

      if (draftId) {
        await deleteDraft(draftId).catch((err: unknown) => {
          console.error("Failed to delete draft after scheduling:", err);
        });
      }

      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("composer.failedToSchedule"));
    }
  }, [getActiveAccount, to, cc, bcc, subject, body, attachments, draftId, close, t]);

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

  if (!isOpen && !showUndoToast) return null;

  if (!isOpen && showUndoToast) {
    return (
      <UndoSendToast
        delayMs={undoSendDelayMs}
        onUndo={handleUndoSend}
        onDismiss={handleUndoToastDismiss}
      />
    );
  }

  const modeLabel =
    mode === "compose"
      ? t("composer.newMessage")
      : mode === "reply"
        ? t("composer.reply")
        : mode === "replyAll"
          ? t("composer.replyAll")
          : t("composer.forward");

  const activeAccount = getActiveAccount();

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
            aria-label={isMinimized ? t("composer.expand") : t("composer.minimize")}
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
            aria-label={t("composer.closeComposer")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      {!isMinimized && (
        <div className="flex flex-col">
          {/* From selector — only visible when account has multiple send-as aliases */}
          {activeAccount && (
            <FromSelector
              accountId={activeAccount.id}
              accountEmail={activeAccount.email}
              value={fromAddress}
              onChange={setFromAddress}
            />
          )}

          {/* To field */}
          <div className="flex items-center border-b border-border-secondary px-4 py-1.5">
            <label className="w-12 shrink-0 text-xs text-text-tertiary">
              {t("composer.to")}
            </label>
            <AddressInput
              value={to}
              onChange={(v) => updateField("to", v)}
              placeholder={t("composer.recipientPlaceholder")}
              autoFocus={mode === "compose"}
            />
            <div className="flex gap-1 text-xs text-text-tertiary">
              {!showCc && (
                <button
                  className="hover:text-text-primary"
                  onClick={() => setShowCc(true)}
                >
                  {t("composer.cc")}
                </button>
              )}
              {!showBcc && (
                <button
                  className="hover:text-text-primary"
                  onClick={() => setShowBcc(true)}
                >
                  {t("composer.bcc")}
                </button>
              )}
            </div>
          </div>

          {/* Cc field */}
          {showCc && (
            <div className="flex items-center border-b border-border-secondary px-4 py-1.5">
              <label className="w-12 shrink-0 text-xs text-text-tertiary">
                {t("composer.cc")}
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
                {t("composer.bcc")}
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
              {t("composer.subject")}
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
            placeholder={t("composer.bodyPlaceholder")}
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
            <div className="flex items-center gap-1">
              <div className="flex items-center">
                <button
                  className="flex items-center gap-2 rounded-l-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                  onClick={handleSend}
                  disabled={isSending}
                >
                  <Send className="h-4 w-4" />
                  {isSending ? t("composer.sending") : t("composer.send")}
                </button>
                <button
                  className="flex items-center rounded-r-lg border-l border-white/20 bg-accent px-1.5 py-1.5 text-white hover:bg-accent-hover disabled:opacity-50"
                  onClick={() => setShowScheduleDialog(true)}
                  disabled={isSending}
                  aria-label={t("composer.scheduleSend")}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <TemplatePicker />
              <SignatureSelector />
            </div>
            <span className="text-xs text-text-tertiary">
              {draftSaved && (
                <span className="mr-2 text-green-500" data-testid="draft-saved-indicator">
                  {t("composer.draftSaved")}
                </span>
              )}
              {t("composer.sendShortcut", {
                key: navigator.platform.includes("Mac") ? "Cmd" : "Ctrl",
              })}
            </span>
          </div>
        </div>
      )}
      <ScheduleSendDialog
        isOpen={showScheduleDialog}
        onClose={() => setShowScheduleDialog(false)}
        onSchedule={handleScheduleSend}
      />
    </div>
  );
}
