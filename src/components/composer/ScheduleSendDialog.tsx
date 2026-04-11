import { useState, useMemo } from "react";
import { X, Clock, Sun, Calendar } from "lucide-react";

interface ScheduleSendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: Date) => void;
}

function getNextWeekdayAt8am(targetDay: number): Date {
  const now = new Date();
  const current = now.getDay();
  let daysUntil = targetDay - current;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  const date = new Date(now);
  date.setDate(date.getDate() + daysUntil);
  date.setHours(8, 0, 0, 0);
  return date;
}

function getTomorrowAt8am(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date;
}

function formatPresetDate(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScheduleSendDialog({
  isOpen,
  onClose,
  onSchedule,
}: ScheduleSendDialogProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("08:00");

  const presets = useMemo(() => {
    const tomorrow = getTomorrowAt8am();
    const monday = getNextWeekdayAt8am(1);

    return [
      {
        label: "Tomorrow morning",
        sublabel: formatPresetDate(tomorrow),
        icon: Sun,
        date: tomorrow,
      },
      {
        label: "Monday morning",
        sublabel: formatPresetDate(monday),
        icon: Calendar,
        date: monday,
      },
    ];
  }, []);

  if (!isOpen) return null;

  const handleCustomSchedule = () => {
    if (!customDate || !customTime) return;
    const [year, month, day] = customDate.split("-").map(Number);
    const [hours, minutes] = customTime.split(":").map(Number);
    if (year == null || month == null || day == null || hours == null || minutes == null) return;
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (date <= new Date()) return;
    onSchedule(date);
  };

  // Minimum date for custom picker: today in YYYY-MM-DD
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-[380px] rounded-xl border border-border-primary bg-bg-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-secondary px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">
              Schedule send
            </span>
          </div>
          <button
            className="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="p-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-bg-hover"
              onClick={() => onSchedule(preset.date)}
            >
              <preset.icon className="h-4 w-4 text-text-secondary" />
              <div className="flex flex-1 items-center justify-between">
                <span className="text-sm text-text-primary">
                  {preset.label}
                </span>
                <span className="text-xs text-text-tertiary">
                  {preset.sublabel}
                </span>
              </div>
            </button>
          ))}

          {/* Custom option toggle */}
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-bg-hover"
            onClick={() => setShowCustom(!showCustom)}
          >
            <Clock className="h-4 w-4 text-text-secondary" />
            <span className="text-sm text-text-primary">
              Pick date & time
            </span>
          </button>
        </div>

        {/* Custom date/time picker */}
        {showCustom && (
          <div className="border-t border-border-secondary px-4 py-3">
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary"
                value={customDate}
                min={minDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
              <input
                type="time"
                className="w-28 rounded-lg border border-border-primary bg-bg-secondary px-3 py-1.5 text-sm text-text-primary"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            </div>
            <button
              className="mt-2 w-full rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              onClick={handleCustomSchedule}
              disabled={!customDate || !customTime}
            >
              Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
