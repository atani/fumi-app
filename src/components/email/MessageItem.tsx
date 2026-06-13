import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Reply, ReplyAll, Forward, ChevronDown, ChevronRight, MailMinus } from "lucide-react";
import { EmailRenderer } from "./EmailRenderer";
import { AttachmentList } from "./AttachmentList";
import { InlineAttachmentPreview } from "./InlineAttachmentPreview";
import { AuthBadge } from "./AuthBadge";
import { PhishingBanner } from "./PhishingBanner";
import { useComposerStore } from "../../stores/composerStore";
import { parseAuthResults } from "../../services/security/authParser";
import { analyzeMessage, getOverallRisk } from "../../services/security/phishingDetector";
import { getUnsubscribeInfo, unsubscribe } from "../../services/unsubscribe/unsubscribeManager";
import { isAllowed, addToAllowlist } from "../../services/email/imageAllowlist";
import { addToPhishingAllowlist, isPhishingAllowed } from "../../services/security/phishingAllowlist";
import type { Account, Message, Attachment, PhishingSensitivity } from "../../types";

interface MessageItemProps {
  message: Message;
  isExpanded: boolean;
  onToggle: () => void;
  account: Account | null;
  attachments: Attachment[];
  phishingSensitivity?: PhishingSensitivity;
}

/**
 * Detect quoted text in an HTML body and split it into [visible, quoted] parts.
 * Looks for Gmail-style `<div class="gmail_quote">` or the pattern
 * `On ... wrote:` followed by blockquote-like content.
 */
function splitQuotedHtml(html: string): { main: string; quoted: string | null } {
  // Gmail quote div
  const gmailQuoteIdx = html.indexOf('<div class="gmail_quote"');
  if (gmailQuoteIdx !== -1) {
    return {
      main: html.slice(0, gmailQuoteIdx),
      quoted: html.slice(gmailQuoteIdx),
    };
  }

  // "On ... wrote:" pattern - look for a <br> or <p> tag followed by the pattern
  const onWroteRegex = /(<br\s*\/?>|<\/p>)\s*(On\s.+?wrote:\s*)/i;
  const match = onWroteRegex.exec(html);
  if (match?.index != null && match[1]) {
    const splitIdx = match.index + match[1].length;
    return {
      main: html.slice(0, splitIdx),
      quoted: html.slice(splitIdx),
    };
  }

  return { main: html, quoted: null };
}

/**
 * Detect quoted text in plain text (lines starting with ">").
 */
function splitQuotedText(text: string): { main: string; quoted: string | null } {
  const lines = text.split("\n");
  let quoteStart = -1;

  // Find the "On ... wrote:" line or first line starting with ">"
  for (let i = 0; i < lines.length; i++) {
    if (/^On\s.+wrote:\s*$/i.test(lines[i]!.trim())) {
      quoteStart = i;
      break;
    }
  }

  // Fallback: find the first block of ">" quoted lines
  if (quoteStart === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.startsWith(">")) {
        // Check if there's a preceding "On ... wrote:" line
        if (i > 0 && /^On\s.+wrote:\s*$/i.test(lines[i - 1]!.trim())) {
          quoteStart = i - 1;
        } else {
          quoteStart = i;
        }
        break;
      }
    }
  }

  if (quoteStart === -1) {
    return { main: text, quoted: null };
  }

  return {
    main: lines.slice(0, quoteStart).join("\n"),
    quoted: lines.slice(quoteStart).join("\n"),
  };
}

type RelativeDate =
  | { kind: "absolute"; value: string }
  | { kind: "key"; key: string; count?: number };

function formatRelativeDate(dateStr: string | null): RelativeDate {
  if (!dateStr) return { kind: "absolute", value: "" };
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return { kind: "key", key: "email.message.justNow" };
  if (diffMins < 60) return { kind: "key", key: "email.message.minutesAgo", count: diffMins };
  if (diffHours < 24) return { kind: "key", key: "email.message.hoursAgo", count: diffHours };
  if (diffDays < 7) return { kind: "key", key: "email.message.daysAgo", count: diffDays };
  return { kind: "absolute", value: date.toLocaleDateString() };
}

export function MessageItem({
  message,
  isExpanded,
  onToggle,
  account,
  attachments,
  phishingSensitivity = "default",
}: MessageItemProps) {
  const { t } = useTranslation();
  const [showQuoted, setShowQuoted] = useState(false);
  const [trustedSender, setTrustedSender] = useState(false);

  // Check phishing allowlist on mount / sender change
  useEffect(() => {
    if (!account || !message.from_address) return;
    let cancelled = false;
    isPhishingAllowed(account.id, message.from_address).then((allowed) => {
      if (!cancelled) setTrustedSender(allowed);
    }).catch(() => {
      // Ignore — keep default (untrusted)
    });
    return () => { cancelled = true; };
  }, [account, message.from_address]);
  const [unsubscribeStatus, setUnsubscribeStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [allowRemoteImages, setAllowRemoteImages] = useState(false);

  // Check image allowlist on mount / sender change
  useEffect(() => {
    if (!account || !message.from_address) return;
    let cancelled = false;
    isAllowed(account.id, message.from_address).then((allowed) => {
      if (!cancelled) setAllowRemoteImages(allowed);
    }).catch(() => {
      // Ignore errors — images stay blocked by default
    });
    return () => { cancelled = true; };
  }, [account, message.from_address]);

  const handleAllowSender = useCallback(() => {
    if (!account || !message.from_address) return;
    setAllowRemoteImages(true);
    void addToAllowlist(account.id, message.from_address);
  }, [account, message.from_address]);

  // Split attachments into inline (image/pdf with content_id) and regular
  const inlineAttachments = useMemo(
    () => attachments.filter(
      (a) => a.content_id != null && (a.mime_type.startsWith("image/") || a.mime_type === "application/pdf"),
    ),
    [attachments],
  );

  const regularAttachments = useMemo(
    () => attachments.filter(
      (a) => a.content_id == null || (!a.mime_type.startsWith("image/") && a.mime_type !== "application/pdf"),
    ),
    [attachments],
  );

  const unsubscribeInfo = useMemo(
    () => getUnsubscribeInfo(message),
    [message],
  );

  const handleUnsubscribe = useCallback(async () => {
    if (!account || unsubscribeStatus === "loading" || unsubscribeStatus === "done") return;
    setUnsubscribeStatus("loading");
    const result = await unsubscribe(account, message);
    setUnsubscribeStatus(result.success ? "done" : "error");
  }, [account, message, unsubscribeStatus]);

  const quotedContent = useMemo(() => {
    if (message.body_html) {
      return splitQuotedHtml(message.body_html);
    }
    const text = message.body_text ?? message.snippet ?? "";
    if (text) {
      return splitQuotedText(text);
    }
    return { main: null, quoted: null };
  }, [message.body_html, message.body_text, message.snippet]);

  const hasQuotedContent = quotedContent.quoted !== null;

  const authResult = useMemo(
    () => parseAuthResults(message.auth_results),
    [message.auth_results],
  );

  const phishingAnalyses = useMemo(() => {
    if (!message.body_html || trustedSender) return [];
    return analyzeMessage(message.body_html, phishingSensitivity, message.from_address);
  }, [message.body_html, message.from_address, phishingSensitivity, trustedSender]);

  const overallRisk = useMemo(
    () => getOverallRisk(phishingAnalyses),
    [phishingAnalyses],
  );

  const senderDisplay =
    message.from_name || message.from_address || t("email.message.unknownSender");
  const snippet = message.snippet ?? "";

  const renderRelativeDate = (dateStr: string | null): string => {
    const rel = formatRelativeDate(dateStr);
    return rel.kind === "absolute"
      ? rel.value
      : t(rel.key, rel.count != null ? { count: rel.count } : undefined);
  };

  if (!isExpanded) {
    // Collapsed view: single line with sender, snippet, and date
    return (
      <div
        className="flex cursor-pointer items-center gap-3 border-b border-border-secondary px-6 py-3 hover:bg-bg-hover"
        onClick={onToggle}
        data-testid={`message-collapsed-${message.id}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-text-tertiary" />
        <span className="flex-shrink-0 font-medium text-text-primary">
          {senderDisplay}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-text-tertiary">
          {snippet}
        </span>
        <span className="flex-shrink-0 text-xs text-text-tertiary">
          {renderRelativeDate(message.date)}
        </span>
      </div>
    );
  }

  // Expanded view: full message
  return (
    <div
      className="border-b border-border-secondary px-6 py-4"
      data-testid={`message-expanded-${message.id}`}
    >
      {/* Header row - click to collapse */}
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-text-tertiary" />
          <span className="font-medium text-text-primary">{senderDisplay}</span>
          {message.from_name && (
            <span className="text-sm text-text-tertiary">
              &lt;{message.from_address}&gt;
            </span>
          )}
          <AuthBadge authResult={authResult} />
        </div>
        <span className="text-xs text-text-tertiary">
          {message.date ? new Date(message.date).toLocaleString() : ""}
        </span>
      </div>

      {/* Recipients */}
      <div className="mt-1 pl-6 text-xs text-text-secondary">
        {t("email.message.to", { addresses: message.to_addresses })}
      </div>
      {message.cc_addresses && (
        <div className="pl-6 text-xs text-text-secondary">
          {t("email.message.cc", { addresses: message.cc_addresses })}
        </div>
      )}

      {/* Unsubscribe link */}
      {unsubscribeInfo.canUnsubscribe && (
        <div className="mt-1 pl-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleUnsubscribe();
            }}
            disabled={unsubscribeStatus === "loading" || unsubscribeStatus === "done"}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:text-text-tertiary disabled:no-underline"
            data-testid="unsubscribe-btn"
          >
            <MailMinus className="h-3 w-3" />
            {unsubscribeStatus === "idle" && t("email.message.unsubscribe")}
            {unsubscribeStatus === "loading" && t("email.message.unsubscribing")}
            {unsubscribeStatus === "done" && t("email.message.unsubscribed")}
            {unsubscribeStatus === "error" && t("email.message.unsubscribeFailed")}
          </button>
        </div>
      )}

      {/* Phishing banner */}
      {overallRisk !== "safe" && (
        <PhishingBanner
          analyses={phishingAnalyses}
          overallRisk={overallRisk}
          onTrustSender={async () => {
            setTrustedSender(true);
            if (account && message.from_address) {
              await addToPhishingAllowlist(account.id, message.from_address);
            }
          }}
          onReport={() => {
            // Placeholder: in a real app this would report the message
            console.warn("Phishing reported for message:", message.id);
          }}
        />
      )}

      {/* Body */}
      <div className="mt-4 text-sm text-text-primary">
        {message.body_html ? (
          <>
            <EmailRenderer
              html={hasQuotedContent && !showQuoted ? quotedContent.main : message.body_html}
              text={null}
              allowRemoteImages={allowRemoteImages}
              onAllowSender={handleAllowSender}
            />
            {hasQuotedContent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuoted((prev) => !prev);
                }}
                className="mt-2 rounded px-2 py-1 text-xs text-text-tertiary hover:bg-bg-hover hover:text-text-secondary"
                data-testid="toggle-quoted-text"
              >
                {showQuoted ? t("email.message.hideQuotedText") : t("email.message.showQuotedText")}
              </button>
            )}
          </>
        ) : (
          <>
            <EmailRenderer
              html={null}
              text={hasQuotedContent && !showQuoted ? quotedContent.main : (message.body_text ?? message.snippet)}
            />
            {hasQuotedContent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuoted((prev) => !prev);
                }}
                className="mt-2 rounded px-2 py-1 text-xs text-text-tertiary hover:bg-bg-hover hover:text-text-secondary"
                data-testid="toggle-quoted-text"
              >
                {showQuoted ? t("email.message.hideQuotedText") : t("email.message.showQuotedText")}
              </button>
            )}
          </>
        )}
      </div>

      {/* Inline attachment previews (images & PDFs with content_id) */}
      {account && inlineAttachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="inline-attachment-previews">
          {inlineAttachments.map((att) => (
            <InlineAttachmentPreview key={att.id} attachment={att} account={account} />
          ))}
        </div>
      )}

      {/* Regular attachments */}
      {account && regularAttachments.length > 0 && (
        <AttachmentList attachments={regularAttachments} account={account} />
      )}

      {/* Per-message action buttons */}
      <div className="mt-3 flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            useComposerStore.getState().openReply(message);
          }}
          title={t("email.message.reply")}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          data-testid="message-reply-btn"
        >
          <Reply className="h-3.5 w-3.5" /> {t("email.message.reply")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (account) {
              useComposerStore.getState().openReplyAll(message, account.email);
            }
          }}
          title={t("email.message.replyAll")}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          data-testid="message-reply-all-btn"
        >
          <ReplyAll className="h-3.5 w-3.5" /> {t("email.message.replyAll")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            useComposerStore.getState().openForward(message);
          }}
          title={t("email.message.forward")}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          data-testid="message-forward-btn"
        >
          <Forward className="h-3.5 w-3.5" /> {t("email.message.forward")}
        </button>
      </div>
    </div>
  );
}
