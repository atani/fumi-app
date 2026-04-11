interface Props {
  className?: string;
}

export function InboxClearIllustration({ className = "h-24 w-24" }: Props) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <circle cx="48" cy="48" r="32" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <path
        d="M34 48l8 8 20-20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
