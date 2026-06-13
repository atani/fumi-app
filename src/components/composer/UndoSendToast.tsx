import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface UndoSendToastProps {
  /** Total delay in milliseconds */
  delayMs: number;
  /** Called when user clicks Undo */
  onUndo: () => void;
  /** Called when the toast auto-dismisses (send completed or timer expired) */
  onDismiss: () => void;
}

export function UndoSendToast({ delayMs, onUndo, onDismiss }: UndoSendToastProps) {
  const { t } = useTranslation();
  const delaySeconds = Math.round(delayMs / 1000);
  const [remaining, setRemaining] = useState(delaySeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Auto-dismiss when countdown reaches 0
  useEffect(() => {
    if (remaining <= 0) {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
      }
      // Small delay so user sees "0" before dismissal
      const t = setTimeout(onDismiss, 300);
      return () => clearTimeout(t);
    }
  }, [remaining, onDismiss]);

  const handleUndo = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
    }
    onUndo();
  }, [onUndo]);

  const progressPercent = (remaining / delaySeconds) * 100;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 overflow-hidden rounded-lg border border-border-primary bg-bg-secondary shadow-xl"
      data-testid="undo-send-toast"
      role="alert"
    >
      {/* Progress bar */}
      <div className="h-1 w-64 bg-border-secondary">
        <div
          className="h-full bg-accent transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
          data-testid="undo-send-progress"
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-sm text-text-primary" data-testid="undo-send-message">
          {t("composer.messageSent")}
        </span>
        <span className="text-xs tabular-nums text-text-tertiary" data-testid="undo-send-countdown">
          {t("composer.countdownSeconds", { seconds: remaining })}
        </span>
        <button
          onClick={handleUndo}
          className="rounded-md px-3 py-1 text-sm font-medium text-accent hover:bg-accent/10"
          data-testid="undo-send-button"
        >
          {t("composer.undo")}
        </button>
        <button
          onClick={onDismiss}
          className="rounded p-0.5 text-text-tertiary hover:text-text-primary"
          aria-label={t("composer.dismiss")}
          data-testid="undo-send-dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
