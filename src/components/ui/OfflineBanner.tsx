import { WifiOff } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";

export function OfflineBanner() {
  const isOnline = useUIStore((s) => s.isOnline);

  if (isOnline) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-warning bg-warning/10 px-4 py-2 text-xs text-warning"
      role="alert"
      data-testid="offline-banner"
    >
      <WifiOff size={14} />
      <span>
        You&apos;re offline. Changes will sync when reconnected.
      </span>
    </div>
  );
}
