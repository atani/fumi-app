import type { HelpCard as HelpCardData } from "../../constants/helpContent";

interface HelpCardProps {
  card: HelpCardData;
}

export function HelpCard({ card }: HelpCardProps) {
  return (
    <div
      className="rounded-lg border border-border-primary bg-bg-secondary p-4"
      data-testid={`help-card-${card.id}`}
    >
      <h3 className="text-sm font-semibold text-text-primary">{card.title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{card.description}</p>
      {card.steps && card.steps.length > 0 && (
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-text-secondary">
          {card.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
