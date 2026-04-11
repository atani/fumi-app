import { useState, useRef, useEffect } from "react";
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
  label = "Help",
  className = "h-4 w-4",
}: HelpTooltipProps) {
  const navigate = useNavigate();
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
        aria-label={label}
        data-testid={`help-tooltip-${categoryId}`}
      >
        <HelpCircle className={className} />
      </button>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-bg-tertiary px-2 py-1 text-xs text-text-primary shadow">
          {label}
        </span>
      )}
    </span>
  );
}
