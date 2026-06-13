import { useTranslation } from "react-i18next";
import type { HelpCard as HelpCardData } from "../../constants/helpContent";

interface HelpCardProps {
  card: HelpCardData;
}

export function HelpCard({ card }: HelpCardProps) {
  const { t } = useTranslation();
  const steps = card.hasSteps
    ? (t(`help.cards.${card.id}.steps`, { returnObjects: true }) as string[])
    : [];

  return (
    <div
      className="rounded-lg border border-border-primary bg-bg-secondary p-4"
      data-testid={`help-card-${card.id}`}
    >
      <h3 className="text-sm font-semibold text-text-primary">
        {t(`help.cards.${card.id}.title`)}
      </h3>
      <p className="mt-1 text-sm text-text-secondary">
        {t(`help.cards.${card.id}.description`)}
      </p>
      {steps.length > 0 && (
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-text-secondary">
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
