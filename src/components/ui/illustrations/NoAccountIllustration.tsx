interface Props {
  className?: string;
}

export function NoAccountIllustration({ className = "h-24 w-24" }: Props) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="12"
        y="24"
        width="72"
        height="48"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        d="M12 28l36 24 36-24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
      />
      <circle cx="64" cy="56" r="14" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <text
        x="64"
        y="62"
        textAnchor="middle"
        fill="currentColor"
        fontSize="18"
        fontWeight="bold"
        opacity="0.6"
      >
        ?
      </text>
    </svg>
  );
}
