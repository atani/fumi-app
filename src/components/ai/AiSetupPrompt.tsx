import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

/**
 * Shown when a user triggers an AI feature without having configured a provider
 * and API key. Instead of a raw "AI is not configured" error, it explains what's
 * needed and links to Settings — so trial users actually reach the AI features
 * (a headline selling point) instead of hitting a dead end.
 */
export function AiSetupPrompt({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      className="mt-2 rounded-lg border border-accent/30 bg-accent-light/40 px-4 py-3"
      data-testid="ai-setup-prompt"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Sparkles className="h-4 w-4 text-accent" />
        {t("ai.setupTitle")}
      </div>
      {!compact && (
        <p className="mt-1 text-xs text-text-secondary">
          {t("ai.setupDescription")}
        </p>
      )}
      <button
        onClick={() => navigate("/settings")}
        className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
        data-testid="ai-setup-button"
      >
        {t("ai.setupButton")}
      </button>
    </div>
  );
}
