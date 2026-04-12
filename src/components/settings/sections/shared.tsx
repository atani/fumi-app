import type { ReactNode } from "react";

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  testId,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-tertiary">{description}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          enabled ? "bg-accent" : "bg-border-secondary"
        }`}
        role="switch"
        aria-checked={enabled}
        data-testid={testId}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
