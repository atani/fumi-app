interface Props {
  className?: string;
}

export function ReadingPaneIllustration({ className = "h-24 w-24" }: Props) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Envelope body */}
      <rect
        x="12"
        y="32"
        width="72"
        height="44"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      {/* Envelope flap (open) */}
      <path
        d="M12 36l36-16 36 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.4"
      />
      {/* Letter peeking out */}
      <rect
        x="24"
        y="28"
        width="48"
        height="32"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
      />
      <line x1="32" y1="38" x2="64" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="32" y1="44" x2="56" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="32" y1="50" x2="60" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    </svg>
  );
}
