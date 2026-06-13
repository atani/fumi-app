import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HelpTooltipProps {
  /** The help category id to link to, e.g. "composing" */
  categoryId: string;
  /** Short tooltip text shown on hover */
  label?: string;
  /** Icon size in Tailwind classes */
  className?: string;
}

export function HelpTooltip({
  categoryId,
  label,
  className = "h-4 w-4",
}: HelpTooltipProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tooltipLabel = label ?? t("help.tooltipLabel");
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setShowTooltip(true), 300);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => navigate(`/help/${categoryId}`)}
        className="rounded p-0.5 text-text-tertiary hover:text-accent"
        aria-label={tooltipLabel}
        data-testid={`help-tooltip-${categoryId}`}
      >
        <HelpCircle className={className} />
      </button>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-bg-tertiary px-2 py-1 text-xs text-text-primary shadow">
          {tooltipLabel}
        </span>
      )}
    </span>
  );
}
