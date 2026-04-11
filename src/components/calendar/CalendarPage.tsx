import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccountStore } from "../../stores/accountStore";
import { listCalendars, listEvents, createEvent } from "../../services/google/calendar";
import type { CalendarEvent, GoogleCalendar } from "../../types";
import { EventCard } from "./EventCard";
import { EventCreateModal } from "./EventCreateModal";

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday = 0, shift to Monday-start
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateHeader(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatHour(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dateToYMD(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function CalendarPage() {
  const navigate = useNavigate();
  const { getActiveAccount } = useAccountStore();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<{
    date: string;
    hour: number;
  } | null>(null);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const today = useMemo(() => new Date(), []);

  const loadEvents = useCallback(async () => {
    const account = getActiveAccount();
    if (!account || account.provider !== "gmail_api") return;

    setIsLoading(true);
    setError(null);
    try {
      const cals = await listCalendars(account);
      setCalendars(cals);

      const timeMin = weekStart.toISOString();
      const timeMax = addDays(weekStart, 7).toISOString();

      const primaryCal = cals.find((c) => c.primary) ?? cals[0];
      if (!primaryCal) {
        setEvents([]);
        return;
      }

      const items = await listEvents(account, primaryCal.id, timeMin, timeMax);
      setEvents(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load events";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [getActiveAccount, weekStart]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const handlePrevWeek = () => setWeekStart((w) => addDays(w, -7));
  const handleNextWeek = () => setWeekStart((w) => addDays(w, 7));
  const handleToday = () => setWeekStart(startOfWeek(new Date()));

  const handleSlotClick = (date: Date, hour: number) => {
    setCreateModal({ date: dateToYMD(date), hour });
  };

  const handleCreateEvent = async (eventData: {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
  }) => {
    const account = getActiveAccount();
    if (!account) return;

    const primaryCal = calendars.find((c) => c.primary) ?? calendars[0];
    if (!primaryCal) return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await createEvent(account, primaryCal.id, {
        summary: eventData.summary,
        description: eventData.description || undefined,
        start: { dateTime: eventData.startDateTime, timeZone: tz },
        end: { dateTime: eventData.endDateTime, timeZone: tz },
      });
      await loadEvents();
    } catch (err) {
      console.error("Failed to create event:", err);
    }
  };

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((ev) => {
      const start = ev.start.dateTime ?? ev.start.date;
      if (!start) return false;
      return isSameDay(new Date(start), day);
    });
  };

  const getEventPosition = (
    ev: CalendarEvent,
  ): { topPx: number; heightPx: number } => {
    const start = new Date(ev.start.dateTime ?? ev.start.date ?? "");
    const end = new Date(ev.end.dateTime ?? ev.end.date ?? "");
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const duration = Math.max(endMinutes - startMinutes, 15);
    return {
      topPx: (startMinutes / 60) * HOUR_HEIGHT,
      heightPx: (duration / 60) * HOUR_HEIGHT,
    };
  };

  const account = getActiveAccount();
  const isGmail = account?.provider === "gmail_api";

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Header */}
      <div
        className="flex h-12 items-center gap-3 border-b border-border-primary px-4"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <button
          onClick={() => navigate("/")}
          className="rounded p-1 text-text-tertiary hover:bg-bg-hover hover:text-text-primary"
          title="Back to mail"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Calendar</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="rounded p-1 text-text-secondary hover:bg-bg-hover"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleToday}
            className="rounded-lg border border-border-primary px-3 py-1 text-sm text-text-primary hover:bg-bg-hover"
          >
            Today
          </button>
          <button
            onClick={handleNextWeek}
            className="rounded p-1 text-text-secondary hover:bg-bg-hover"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
          )}
        </div>
      </div>

      {!isGmail && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-text-secondary">
            Calendar is only available for Gmail accounts.
          </p>
        </div>
      )}

      {isGmail && error && (
        <div className="mx-4 mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
          <button
            onClick={() => void loadEvents()}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {isGmail && (
        <div className="flex-1 overflow-auto">
          {/* Day headers */}
          <div className="sticky top-0 z-10 flex border-b border-border-primary bg-bg-primary">
            <div className="w-16 shrink-0" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`flex-1 border-l border-border-primary px-2 py-2 text-center text-xs font-medium ${
                  isSameDay(day, today)
                    ? "text-accent"
                    : "text-text-secondary"
                }`}
              >
                {formatDateHeader(day)}
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative flex">
            {/* Hour labels */}
            <div className="w-16 shrink-0">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start justify-end pr-2 text-xs text-text-tertiary"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="-mt-2">{formatHour(hour)}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className="relative flex-1 border-l border-border-primary"
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border-primary/50 hover:bg-bg-hover/30"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={() => handleSlotClick(day, hour)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleSlotClick(day, hour);
                        }
                      }}
                    />
                  ))}
                  {/* Events overlay */}
                  {dayEvents.map((ev) => {
                    const { topPx, heightPx } = getEventPosition(ev);
                    return (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        topPx={topPx}
                        heightPx={heightPx}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <EventCreateModal
        isOpen={createModal !== null}
        onClose={() => setCreateModal(null)}
        onSave={(data) => void handleCreateEvent(data)}
        initialDate={createModal?.date}
        initialHour={createModal?.hour}
      />
    </div>
  );
}
