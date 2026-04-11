import type { ReactNode } from "react";

interface EmptyStateProps {
  illustration: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  illustration,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center ${className}`}
      data-testid="empty-state"
    >
      <div className="text-text-tertiary">{illustration}</div>
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {description && (
          <p className="max-w-xs text-xs text-text-tertiary">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
