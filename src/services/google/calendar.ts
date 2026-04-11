import type { Account, CalendarEvent, GoogleCalendar } from "../../types";
import { withTokenRefresh } from "../gmail/tokenManager";
import { getDb } from "../db/connection";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

async function calendarFetch<T>(
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${CALENDAR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calendar API error (${response.status}): ${error}`);
  }

  return response.json();
}

export async function listCalendars(
  account: Account,
): Promise<GoogleCalendar[]> {
  const result = await withTokenRefresh(account, (token) =>
    calendarFetch<{ items: GoogleCalendar[] }>(
      token,
      "/users/me/calendarList",
    ),
  );
  return result.items ?? [];
}

interface CachedEventRow {
  id: string;
  account_id: string;
  calendar_id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  color: string | null;
  updated_at: string;
}

function rowToCalendarEvent(row: CachedEventRow): CalendarEvent {
  return {
    id: row.id,
    summary: row.title,
    description: row.description ?? undefined,
    start: { dateTime: row.start_time ?? undefined },
    end: { dateTime: row.end_time ?? undefined },
    colorId: row.color ?? undefined,
  };
}

async function getCachedEvents(
  accountId: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const db = await getDb();
  const rows = await db.select<CachedEventRow[]>(
    `SELECT * FROM calendar_events
     WHERE account_id = $1 AND calendar_id = $2
       AND start_time >= $3 AND start_time <= $4
     ORDER BY start_time`,
    [accountId, calendarId, timeMin, timeMax],
  );
  return rows.map(rowToCalendarEvent);
}

async function cacheEvents(
  accountId: string,
  calendarId: string,
  events: CalendarEvent[],
): Promise<void> {
  const db = await getDb();
  for (const event of events) {
    const startTime = event.start.dateTime ?? event.start.date ?? null;
    const endTime = event.end.dateTime ?? event.end.date ?? null;
    await db.execute(
      `INSERT OR REPLACE INTO calendar_events (id, account_id, calendar_id, title, start_time, end_time, description, color, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))`,
      [
        event.id,
        accountId,
        calendarId,
        event.summary ?? "",
        startTime,
        endTime,
        event.description ?? null,
        event.colorId ?? null,
      ],
    );
  }
}

/**
 * List events for a calendar. Returns cached events first, then refreshes
 * from the API in the background. If the API call fails, the cached data
 * is returned as a fallback.
 */
export async function listEvents(
  account: Account,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  // Try cache first
  const cached = await getCachedEvents(account.id, calendarId, timeMin, timeMax);

  // Always attempt to refresh from API
  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const encodedId = encodeURIComponent(calendarId);
    const result = await withTokenRefresh(account, (token) =>
      calendarFetch<{ items: CalendarEvent[] }>(
        token,
        `/calendars/${encodedId}/events?${params}`,
      ),
    );
    const fresh = result.items ?? [];

    // Cache the fresh data
    void cacheEvents(account.id, calendarId, fresh);

    return fresh;
  } catch (err) {
    // If API fails and we have cached data, return it
    if (cached.length > 0) {
      console.warn("Calendar API failed, returning cached events:", err);
      return cached;
    }
    throw err;
  }
}

export async function createEvent(
  account: Account,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
  },
): Promise<CalendarEvent> {
  const encodedId = encodeURIComponent(calendarId);
  return withTokenRefresh(account, (token) =>
    calendarFetch<CalendarEvent>(token, `/calendars/${encodedId}/events`, {
      method: "POST",
      body: JSON.stringify(event),
    }),
  );
}
