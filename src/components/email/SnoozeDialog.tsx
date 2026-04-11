import { useState } from "react";
import { Clock, Sun, Moon, Calendar, ChevronRight, X } from "lucide-react";

interface SnoozeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (until: string) => void;
}

interface SnoozePreset {
  label: string;
  icon: typeof Clock;
  getDate: () => Date;
}

function getPresets(): SnoozePreset[] {
  const now = new Date();

  return [
    {
      label: "Later today",
      icon: Clock,
      getDate: () => {
        const d = new Date(now);
        d.setHours(d.getHours() + 3);
        return d;
      },
    },
    {
      label: "Tomorrow morning",
      icon: Sun,
      getDate: () => {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: "Tomorrow afternoon",
      icon: Moon,
      getDate: () => {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(14, 0, 0, 0);
        return d;
      },
    },
    {
      label: "This weekend",
      icon: Calendar,
      getDate: () => {
        const d = new Date(now);
        const day = d.getDay();
        // Next Saturday
        const daysUntilSat = (6 - day + 7) % 7 || 7;
        d.setDate(d.getDate() + daysUntilSat);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: "Next week",
      icon: ChevronRight,
      getDate: () => {
        const d = new Date(now);
        const day = d.getDay();
        // Next Monday
        const daysUntilMon = (1 - day + 7) % 7 || 7;
        d.setDate(d.getDate() + daysUntilMon);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];
}

function formatPresetTime(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SnoozeDialog({ isOpen, onClose, onSnooze }: SnoozeDialogProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("09:00");

  if (!isOpen) return null;

  const presets = getPresets();

  const handlePreset = (preset: SnoozePreset) => {
    onSnooze(preset.getDate().toISOString());
    onClose();
  };

  const handleCustomSubmit = () => {
    if (!customDate) return;
    const [hours, minutes] = customTime.split(":").map(Number);
    const d = new Date(customDate);
    d.setHours(hours ?? 9, minutes ?? 0, 0, 0);
    if (d > new Date()) {
      onSnooze(d.toISOString());
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-primary bg-bg-primary shadow-xl">
        <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">Snooze until...</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!showCustom ? (
          <div className="py-1">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const date = preset.getDate();
              return (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-hover"
                >
                  <Icon className="h-4 w-4 text-text-secondary" />
                  <span className="flex-1 text-left">{preset.label}</span>
                  <span className="text-xs text-text-tertiary">
                    {formatPresetTime(date)}
                  </span>
                </button>
              );
            })}
            <div className="border-t border-border-secondary" />
            <button
              onClick={() => setShowCustom(true)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-hover"
            >
              <Calendar className="h-4 w-4 text-text-secondary" />
              <span className="flex-1 text-left">Pick date & time</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Date</label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Time</label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 rounded-lg border border-border-primary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
              >
                Back
              </button>
              <button
                onClick={handleCustomSubmit}
                disabled={!customDate}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Snooze
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
