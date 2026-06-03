"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent, CalendarResult } from "@/lib/calendar";
import { JoinAndRecordButton } from "@/components/meetings/JoinAndRecordButton";

type Props = {
  result: CalendarResult;
  compact?: boolean;
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function timeUntil(iso: string): { mins: number; label: string } {
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.round(ms / 60_000);
  if (mins < 0) return { mins, label: "now" };
  if (mins < 60) return { mins, label: `${mins}m` };
  const hours = Math.round(mins / 60);
  if (hours < 24) return { mins, label: `${hours}h` };
  return { mins, label: `${Math.round(hours / 24)}d` };
}

function formatStartLocal(iso: string, allDay: boolean): string {
  if (!iso) return "";
  if (allDay) {
    // All-day events come as YYYY-MM-DD — parse as local date to avoid UTC shift
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(d);
    }
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function CalendarWidget({ result, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Collapsed-chip content varies by state
  const nextEvent: CalendarEvent | null =
    result.kind === "ok" && result.events.length > 0 ? result.events[0] : null;

  const chipLabel = (() => {
    if (result.kind === "no-token") return "Calendar";
    if (result.kind === "error") return "Calendar";
    if (!nextEvent) return "Free";
    const until = timeUntil(nextEvent.start);
    return until.mins < 0 ? "Live now" : `Next · ${until.label}`;
  })();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Upcoming meetings"
        className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-rule bg-surface hover:border-emerald/40 hover:bg-bg-elevated transition-all text-[12px]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink-muted"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={compact ? "hidden" : "text-ink-strong"}>{chipLabel}</span>
        {nextEvent && !compact && (
          <span className="text-ink-muted truncate max-w-[120px] hidden lg:inline">
            {nextEvent.title}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed left-2 right-2 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-[360px] md:max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] bg-surface border border-rule rounded-card shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200 flex flex-col"
          role="dialog"
        >
          <div className="px-4 py-3 border-b border-rule bg-bg-elevated flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-strong">
              ◆ Upcoming
            </div>
            <a
              href="https://calendar.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-emerald hover:underline"
            >
              Open Calendar ↗
            </a>
          </div>

          {result.kind === "no-token" && (
            <div className="px-4 py-6 text-center">
              <div className="text-[13px] text-ink-strong mb-2">Calendar not connected</div>
              <p className="text-[12px] text-ink-muted mb-3 leading-snug">
                Sign out and sign in again to grant access to your Google Calendar.
              </p>
              <a
                href="/api/auth/signout"
                className="inline-block px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors"
              >
                Sign out to reconnect
              </a>
            </div>
          )}

          {result.kind === "error" && (
            <div className="px-4 py-6 text-center text-[12px] text-red">
              Calendar API error: {result.message}
            </div>
          )}

          {result.kind === "ok" && result.events.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-ink-faint font-mono">
              No events in the next 7 days.
            </div>
          )}

          {result.kind === "ok" && result.events.length > 0 && (
            <ul className="divide-y divide-rule flex-1 overflow-y-auto">
              {result.events.map((ev) => {
                const until = timeUntil(ev.start);
                const startingSoon = until.mins >= 0 && until.mins <= 15;
                const live = until.mins < 0 && until.mins > -60;
                return (
                  <li key={ev.id}>
                    <div className="block px-4 py-3 hover:bg-bg-elevated transition-colors group">
                      <div className="flex items-start justify-between gap-3">
                        <a
                          href={ev.conferenceLink ?? ev.link ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1"
                        >
                          <div className="text-[13px] text-ink-strong font-medium leading-snug truncate group-hover:text-emerald transition-colors">
                            {ev.title}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-ink-muted">
                            <span className="font-mono">{formatStartLocal(ev.start, ev.allDay)}</span>
                            {!ev.allDay && ev.durationMins != null && (
                              <>
                                <span className="text-ink-faint">·</span>
                                <span>{ev.durationMins}m</span>
                              </>
                            )}
                            {ev.attendeeCount > 0 && (
                              <>
                                <span className="text-ink-faint">·</span>
                                <span>{ev.attendeeCount} attendees</span>
                              </>
                            )}
                          </div>
                          {ev.location && (
                            <div className="text-[10px] text-ink-faint mt-0.5 truncate">
                              {ev.location}
                            </div>
                          )}
                        </a>
                        <div className="text-right shrink-0">
                          {live && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-red/15 text-red border border-red/30">
                              Live
                            </span>
                          )}
                          {startingSoon && !live && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-amber/15 text-amber border border-amber/30">
                              {until.label}
                            </span>
                          )}
                          {!startingSoon && !live && (
                            <span className="text-[11px] font-mono text-ink-faint">
                              {isToday(ev.start) ? "today" : until.label}
                            </span>
                          )}
                          {ev.conferenceLink && (
                            <div className="mt-1">
                              <JoinAndRecordButton
                                meetingUrl={ev.conferenceLink}
                                label="Join + record ↗"
                                className="text-[10px] text-emerald font-mono hover:underline"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
