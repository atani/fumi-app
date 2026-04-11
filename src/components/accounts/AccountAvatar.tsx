import { useState } from "react";
import type { Account } from "../../types";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
];

function colorForEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

interface AccountAvatarProps {
  account: Account;
  size?: "sm" | "md";
  className?: string;
}

export function AccountAvatar({
  account,
  size = "md",
  className = "",
}: AccountAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  const letter = (account.email[0] ?? "?").toUpperCase();

  if (account.picture && !imgError) {
    return (
      <img
        src={account.picture}
        alt={account.email}
        onError={() => setImgError(true)}
        className={`${sizeClasses} shrink-0 rounded-full object-cover ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} ${colorForEmail(account.email)} flex shrink-0 items-center justify-center rounded-full font-medium text-white ${className}`}
    >
      {letter}
    </div>
  );
}
