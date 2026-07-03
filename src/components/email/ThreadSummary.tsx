import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Message } from "../../types";
import { summarizeThread } from "../../services/ai/aiService";
import { AiNotConfiguredError } from "../../services/ai/errors";
import { AiSetupPrompt } from "../ai/AiSetupPrompt";

interface ThreadSummaryProps {
  messages: Message[];
  threadId: string;
  accountId: string;
}

export function ThreadSummary({
  messages,
  threadId,
  accountId,
}: ThreadSummaryProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAiSetup, setNeedsAiSetup] = useState(false);

  const handleSummarize = useCallback(async () => {
    if (summary) {
      setIsExpanded((prev) => !prev);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNeedsAiSetup(false);
    try {
      const result = await summarizeThread(messages, threadId, accountId);
      setSummary(result);
      setIsExpanded(true);
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        setNeedsAiSetup(true);
      } else {
        setError(
          err instanceof Error ? err.message : t("email.summary.generateFailed"),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [summary, messages, threadId, accountId, t]);

  return (
    <div data-testid="thread-summary">
      <button
        onClick={() => void handleSummarize()}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50"
        data-testid="summarize-btn"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {summary ? t("email.summary.summary") : t("email.summary.summarize")}
        {summary &&
          (isExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </button>

      {needsAiSetup && <AiSetupPrompt />}

      {error && (
        <div className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {summary && isExpanded && (
        <div
          className="mt-2 rounded-lg border border-border-secondary bg-bg-secondary px-4 py-3 text-sm leading-relaxed text-text-secondary"
          data-testid="summary-content"
        >
          {summary}
        </div>
      )}
    </div>
  );
}
