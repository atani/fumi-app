import type { Account, CalendarEvent, GoogleCalendar } from "../../types";
import { withTokenRefresh } from "../gmail/tokenManager";

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

export async function listEvents(
  account: Account,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
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
  return result.items ?? [];
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
