import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquare } from "lucide-react";
import type { Message } from "../../types";
import { suggestReplies } from "../../services/ai/aiService";
import { AiNotConfiguredError } from "../../services/ai/errors";
import { AiSetupPrompt } from "../ai/AiSetupPrompt";
import { useComposerStore } from "../../stores/composerStore";

interface SmartReplySuggestionsProps {
  messages: Message[];
  threadId: string;
  accountId: string;
}

export function SmartReplySuggestions({
  messages,
  threadId,
  accountId,
}: SmartReplySuggestionsProps) {
  const { t } = useTranslation();
  const [replies, setReplies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAiSetup, setNeedsAiSetup] = useState(false);

  useEffect(() => {
    setReplies([]);
    setError(null);
    setNeedsAiSetup(false);
  }, [threadId]);

  const handleLoadSuggestions = useCallback(async () => {
    if (replies.length > 0 || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await suggestReplies(messages, threadId, accountId);
      setReplies(result);
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        setNeedsAiSetup(true);
      } else {
        setError(
          err instanceof Error ? err.message : t("email.smartReply.generateFailed"),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [replies.length, isLoading, messages, threadId, accountId, t]);

  const handleSelectReply = useCallback(
    (replyText: string) => {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) return;

      useComposerStore.getState().openReply(lastMessage);
      // Set the body after opening the reply
      setTimeout(() => {
        useComposerStore.getState().updateField("body", replyText);
      }, 0);
    },
    [messages],
  );

  if (needsAiSetup) {
    return <AiSetupPrompt compact />;
  }

  if (error) {
    return null;
  }

  if (replies.length === 0) {
    return (
      <button
        onClick={() => void handleLoadSuggestions()}
        disabled={isLoading}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-secondary disabled:opacity-50"
        data-testid="smart-reply-load-btn"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MessageSquare className="h-3.5 w-3.5" />
        )}
        {isLoading ? t("email.smartReply.generating") : t("email.smartReply.suggest")}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="smart-reply-suggestions">
      {replies.map((reply, index) => (
        <button
          key={index}
          onClick={() => handleSelectReply(reply)}
          className="rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/15"
          data-testid={`smart-reply-${index}`}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
