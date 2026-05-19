import Link from "next/link";
import type { PersonalDay } from "@/lib/personal-landing";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function priorityDot(p: string | null): string {
  switch (p) {
    case "Urgent": return "bg-red";
    case "High": return "bg-amber";
    case "Medium": return "bg-sky";
    case "Low": return "bg-ink-faint";
    default: return "bg-bg-elevated";
  }
}

function fmtEventTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

type Props = {
  day: PersonalDay;
};

export function YourDay({ day }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-3">
      {/* Today's agenda */}
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <div className="px-5 py-3 border-b border-rule bg-gradient-to-r from-sky/10 via-sky/5 to-transparent">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-strong">
              ◆ Today's agenda
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint tabnum">
              {day.todaysEvents.length} {day.todaysEvents.length === 1 ? "meeting" : "meetings"}
            </div>
          </div>
        </div>
        {day.todaysEvents.length === 0 ? (
          <div className="px-5 py-10 text-center text-[12px] text-ink-faint font-mono">
            Nothing on your calendar today.
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {day.todaysEvents.map((e) => (
              <li key={e.id}>
                <a
                  href={e.conferenceLink ?? e.link ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-bg-elevated transition-colors group"
                >
                  <span className="font-mono text-[11px] text-ink-faint tabnum">
                    {fmtEventTime(e.start, e.allDay)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] text-ink-strong group-hover:text-emerald transition-colors truncate">
                      {e.title}
                    </div>
                    <div className="text-[11px] text-ink-muted truncate">
                      {!e.allDay && e.durationMins != null ? `${e.durationMins}m` : ""}
                      {e.attendeeCount > 0 ? `${!e.allDay && e.durationMins ? " · " : ""}${e.attendeeCount} attendees` : ""}
                      {e.location ? ` · ${e.location}` : ""}
                    </div>
                  </div>
                  {e.conferenceLink && (
                    <span className="text-[10px] font-mono text-emerald shrink-0">Join ↗</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Your stories — in flight summary */}
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <div className="px-5 py-3 border-b border-rule bg-gradient-to-r from-emerald/10 via-emerald/5 to-transparent">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-strong">
              ◆ Your stories in flight
            </div>
            <Link
              href="/me"
              className="text-[10px] font-mono uppercase tracking-wider text-emerald hover:underline"
            >
              Full scorecard →
            </Link>
          </div>
        </div>

        {!day.hasPerson ? (
          <div className="px-5 py-8 text-center">
            <div className="text-[12px] text-ink-muted leading-snug">
              Your email isn't matched to a People record yet. Stories filtered to you
              will appear here once you're linked.
            </div>
          </div>
        ) : day.active.length === 0 ? (
          <div className="px-5 py-10 text-center text-[12px] text-ink-faint font-mono">
            No active stories assigned to you.
          </div>
        ) : (
          <>
            <div className="px-5 py-3 grid grid-cols-4 gap-2 border-b border-rule bg-bg-elevated/40">
              <Stat label="Active" value={day.active.length} tone="neutral" />
              <Stat label="In progress" value={day.inProgress.length} tone="emerald" />
              <Stat label="QA" value={day.qa.length} tone="sky" />
              <Stat label="Open $" value={fmtMoney(day.totalOpenInvoice)} tone="ink" wide />
            </div>
            <ul className="divide-y divide-rule">
              {day.nextToShip.map((s) => (
                <li key={s.id}>
                  <div className="grid grid-cols-[16px_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-bg-elevated transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full ${priorityDot(s.priority)}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-[13px] text-ink-strong truncate">{s.name}</div>
                      <div className="text-[11px] text-ink-muted truncate">
                        {s.status} · {s.clientNames[0] ?? "no client"}
                        {s.sprintNumbers[0] != null && ` · Sprint #${s.sprintNumbers[0]}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-semibold text-ink-strong tabnum">
                        {fmtMoney(s.invoice)}
                      </div>
                      <div className="text-[10px] font-mono text-emerald tabnum">
                        {fmtMoney(s.commission)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "emerald" | "sky" | "ink";
  wide?: boolean;
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald"
      : tone === "sky"
        ? "text-sky"
        : tone === "ink"
          ? "text-ink-strong"
          : "text-ink-strong";
  return (
    <div className={wide ? "col-span-1 text-right" : ""}>
      <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`mt-0.5 ${toneCls} font-semibold tabnum ${wide ? "text-[13px]" : "text-[15px]"}`}>
        {value}
      </div>
    </div>
  );
}
