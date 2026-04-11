import type { CalendarEvent } from "../../types";

interface EventCardProps {
  event: CalendarEvent;
  topPx: number;
  heightPx: number;
}

function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const EVENT_COLORS = [
  "bg-accent/80 text-white",
  "bg-emerald-500/80 text-white",
  "bg-rose-500/80 text-white",
  "bg-amber-500/80 text-white",
  "bg-sky-500/80 text-white",
  "bg-violet-500/80 text-white",
];

function getColorClass(colorId: string | undefined): string {
  if (!colorId) return EVENT_COLORS[0]!;
  const idx = (parseInt(colorId, 10) - 1) % EVENT_COLORS.length;
  return EVENT_COLORS[idx] ?? EVENT_COLORS[0]!;
}

export function EventCard({ event, topPx, heightPx }: EventCardProps) {
  const colorClass = getColorClass(event.colorId);
  const minHeight = Math.max(heightPx, 20);

  return (
    <div
      className={`absolute left-0.5 right-0.5 overflow-hidden rounded px-1.5 py-0.5 text-xs leading-tight ${colorClass}`}
      style={{ top: `${topPx}px`, height: `${minHeight}px` }}
      title={`${event.summary}\n${formatTime(event.start.dateTime)} - ${formatTime(event.end.dateTime)}`}
    >
      <div className="truncate font-medium">{event.summary}</div>
      {minHeight >= 32 && (
        <div className="truncate opacity-80">
          {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
        </div>
      )}
    </div>
  );
}
