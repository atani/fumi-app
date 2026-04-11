interface Props {
  className?: string;
}

export function NoSearchResultsIllustration({ className = "h-24 w-24" }: Props) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="22" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line
        x1="56"
        y1="56"
        x2="76"
        y2="76"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
      <line
        x1="32"
        y1="32"
        x2="48"
        y2="48"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="48"
        y1="32"
        x2="32"
        y2="48"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
