import { useCallback } from "react";
import { ExternalLink, AlertTriangle, X } from "lucide-react";

interface LinkConfirmDialogProps {
  isOpen: boolean;
  url: string;
  displayText: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function LinkConfirmDialog({
  isOpen,
  url,
  displayText,
  onConfirm,
  onCancel,
}: LinkConfirmDialogProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );

  if (!isOpen) return null;

  const urlDomain = getDomain(url);
  const displayDomain = displayText
    ? getDomain(
        displayText.startsWith("http")
          ? displayText
          : `https://${displayText}`,
      )
    : null;

  const hasMismatch =
    displayDomain != null &&
    urlDomain != null &&
    displayDomain !== urlDomain;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="link-confirm-dialog"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-border-primary bg-bg-primary p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Open external link?
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-text-tertiary hover:bg-bg-hover"
            data-testid="link-confirm-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {hasMismatch && (
          <div
            className="mb-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/40"
            data-testid="link-mismatch-warning"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-xs text-red-700 dark:text-red-400">
              The link text shows <strong>{displayDomain}</strong> but the
              actual destination is <strong>{urlDomain}</strong>
            </p>
          </div>
        )}

        <div className="mb-4 rounded-lg bg-bg-secondary p-3">
          {displayText && (
            <div className="mb-2">
              <span className="text-xs text-text-tertiary">Display text: </span>
              <span className="text-xs text-text-secondary">{displayText}</span>
            </div>
          )}
          <div>
            <span className="text-xs text-text-tertiary">Destination: </span>
            <span
              className="break-all text-xs text-accent"
              data-testid="link-confirm-url"
            >
              {url}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border-primary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            data-testid="link-confirm-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            data-testid="link-confirm-open"
          >
            Open link
          </button>
        </div>
      </div>
    </div>
  );
}
