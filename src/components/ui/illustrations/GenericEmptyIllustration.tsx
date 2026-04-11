interface Props {
  className?: string;
}

export function GenericEmptyIllustration({ className = "h-24 w-24" }: Props) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Box body */}
      <path
        d="M20 40v32h56V40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.3"
      />
      {/* Box rim */}
      <path
        d="M16 40h64"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Box flaps */}
      <path
        d="M16 40l12-16h40l12 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.3"
      />
      {/* Dashed line inside (emptiness) */}
      <line
        x1="36"
        y1="56"
        x2="60"
        y2="56"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        opacity="0.2"
      />
    </svg>
  );
}
