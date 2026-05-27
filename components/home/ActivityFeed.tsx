import type { ActivityEvent, ActivityKind } from "@/lib/activity-types";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

const KIND_DOT: Record<ActivityKind, string> = {
  story_created: "bg-violet",
  story_completed: "bg-emerald",
  invoice_paid: "bg-emerald",
  invoice_created: "bg-sky",
  quote_created: "bg-sky",
  quote_won: "bg-emerald",
  sprint_done: "bg-emerald",
  sprint_created: "bg-violet",
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="bg-surface border border-rule rounded-card p-4 text-[12px] text-ink-faint">
        Quiet last 24h — nothing changed.
      </div>
    );
  }

  return (
    <ul className="bg-surface border border-rule rounded-card divide-y divide-rule-soft">
      {events.map((e) => {
        const isExternal = e.href.startsWith("http");
        return (
          <li key={e.id}>
            <a
              href={e.href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg/50 transition-colors text-[13px] text-ink-muted hover:text-ink-strong"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[e.kind] ?? "bg-ink-faint"}`}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{e.text}</span>
              <span className="text-[11px] font-mono tabnum text-ink-faint shrink-0">
                {relativeTime(e.at)}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
