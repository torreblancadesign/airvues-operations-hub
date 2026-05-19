// Google Calendar reader. Uses the user's OAuth access token (stored on the
// NextAuth session) to fetch their upcoming events. Read-only.
import "server-only";

import { auth } from "./auth";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  startLabel: string;
  durationMins: number | null;
  allDay: boolean;
  location: string | null;
  link: string | null;
  conferenceLink: string | null;
  attendeeCount: number;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
  attendees?: { email: string; responseStatus?: string }[];
};

export type CalendarResult =
  | { kind: "ok"; events: CalendarEvent[] }
  | { kind: "no-token" }
  | { kind: "error"; message: string };

function startEndToShape(ev: GoogleEvent): {
  start: string;
  end: string;
  allDay: boolean;
  durationMins: number | null;
} {
  if (ev.start?.dateTime && ev.end?.dateTime) {
    const start = ev.start.dateTime;
    const end = ev.end.dateTime;
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    return { start, end, allDay: false, durationMins: Math.round(durationMs / 60_000) };
  }
  // All-day event (uses date instead of dateTime)
  const start = ev.start?.date ?? ev.start?.dateTime ?? "";
  const end = ev.end?.date ?? ev.end?.dateTime ?? "";
  return { start, end, allDay: true, durationMins: null };
}

function pickConferenceLink(ev: GoogleEvent): string | null {
  if (ev.hangoutLink) return ev.hangoutLink;
  const entry = ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return entry?.uri ?? null;
}

function formatStartLabel(startIso: string, allDay: boolean): string {
  if (!startIso) return "";
  if (allDay) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(startIso));
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startIso));
}

export async function getUpcomingEvents(maxResults = 8): Promise<CalendarResult> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return { kind: "no-token" };

  const now = new Date();
  const max = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // next 7 days
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: max.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });

  try {
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // Cache for 60s — fresh enough for "what's next" without hammering the API
        next: { revalidate: 60 },
      },
    );
    if (resp.status === 401 || resp.status === 403) {
      return { kind: "no-token" };
    }
    if (!resp.ok) {
      return { kind: "error", message: `Calendar API ${resp.status}` };
    }
    const data = await resp.json();
    const items: GoogleEvent[] = data.items ?? [];

    const events: CalendarEvent[] = items
      .filter((ev) => ev.status !== "cancelled")
      .map((ev) => {
        const { start, end, allDay, durationMins } = startEndToShape(ev);
        return {
          id: ev.id,
          title: ev.summary ?? "(no title)",
          start,
          end,
          startLabel: formatStartLabel(start, allDay),
          durationMins,
          allDay,
          location: ev.location ?? null,
          link: ev.htmlLink ?? null,
          conferenceLink: pickConferenceLink(ev),
          attendeeCount: ev.attendees?.length ?? 0,
        };
      });

    return { kind: "ok", events };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}
