import { useState } from "react";
import { X } from "lucide-react";

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
  }) => void;
  initialDate?: string;
  initialHour?: number;
}

function toLocalDateTimeStr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventCreateModal({
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialHour,
}: EventCreateModalProps) {
  const now = new Date();
  const startDefault = new Date(now);
  if (initialDate) {
    const [y, m, d] = initialDate.split("-").map(Number);
    if (y !== undefined && m !== undefined && d !== undefined) {
      startDefault.setFullYear(y, m - 1, d);
    }
  }
  if (initialHour !== undefined) {
    startDefault.setHours(initialHour, 0, 0, 0);
  }
  const endDefault = new Date(startDefault);
  endDefault.setHours(endDefault.getHours() + 1);

  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [startStr, setStartStr] = useState(toLocalDateTimeStr(startDefault));
  const [endStr, setEndStr] = useState(toLocalDateTimeStr(endDefault));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    onSave({
      summary: summary.trim(),
      description: description.trim(),
      startDateTime: new Date(startStr).toISOString(),
      endDateTime: new Date(endStr).toISOString(),
    });
    setSummary("");
    setDescription("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-primary bg-bg-primary p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            New Event
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Title
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="Event title"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Start
              </label>
              <input
                type="datetime-local"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                End
              </label>
              <input
                type="datetime-local"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!summary.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
