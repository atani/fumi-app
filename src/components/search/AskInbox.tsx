import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { askInbox } from "../../services/ai/askInbox";
import { AiNotConfiguredError } from "../../services/ai/errors";
import { AiSetupPrompt } from "../ai/AiSetupPrompt";
import { useAccountStore } from "../../stores/accountStore";

interface AskInboxProps {
  query: string;
}

export function AskInbox({ query }: AskInboxProps) {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAiSetup, setNeedsAiSetup] = useState(false);
  const lastQuery = useRef<string>("");
  const { getActiveAccount } = useAccountStore();

  const handleAsk = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (trimmed === lastQuery.current && answer) return;

    const account = getActiveAccount();
    if (!account) {
      setError(t("search.askNoAccount"));
      return;
    }

    setIsLoading(true);
    setError(null);
    setNeedsAiSetup(false);
    setAnswer(null);
    lastQuery.current = trimmed;

    try {
      const result = await askInbox(account, trimmed);
      setAnswer(result);
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        setNeedsAiSetup(true);
      } else {
        setError(err instanceof Error ? err.message : t("search.askError"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [query, answer, getActiveAccount, t]);

  return (
    <div className="max-h-80 overflow-y-auto" data-testid="ask-inbox-panel">
      {needsAiSetup && (
        <div className="px-4 py-4">
          <AiSetupPrompt />
        </div>
      )}

      {!answer && !isLoading && !error && !needsAiSetup && (
        <div className="px-4 py-6 text-center">
          <button
            onClick={() => void handleAsk()}
            disabled={!query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            data-testid="ask-inbox-submit"
          >
            <Sparkles className="h-4 w-4" />
            {t("search.askButton")}
          </button>
          <p className="mt-2 text-xs text-text-tertiary">
            {t("search.askHint")}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("search.askThinking")}
        </div>
      )}

      {error && (
        <div className="px-4 py-4">
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        </div>
      )}

      {answer && (
        <div className="px-4 py-4" data-testid="ask-inbox-answer">
          <div className="rounded-lg border border-border-secondary bg-bg-secondary px-4 py-3 text-sm leading-relaxed text-text-secondary">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              {t("search.askAnswerLabel")}
            </div>
            {answer}
          </div>
        </div>
      )}
    </div>
  );
}
