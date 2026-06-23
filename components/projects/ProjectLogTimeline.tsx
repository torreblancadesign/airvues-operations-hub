// Project Log timeline — renders the audit trail for a project or account.
// Server component; data passed in from the page.
import type { ProjectLogEntry } from "@/lib/project-log-types";

function eventDot(eventType: string): string {
  if (eventType.includes("signed") || eventType.includes("Won") || eventType.includes("completed")) return "bg-emerald";
  if (eventType.includes("Payment") || eventType.includes("Invoice")) return "bg-sky";
  if (eventType.includes("Deadline")) return "bg-amber";
  if (eventType.includes("Lost")) return "bg-red";
  return "bg-ink-faint";
}

function fmt(ts: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (!isFinite(d.getTime())) return ts;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ProjectLogTimeline({
  entries,
  title = "Project log",
  emptyHint = "No events yet. Activity will appear here as proposals are signed, invoices land, and stories ship.",
}: {
  entries: ProjectLogEntry[];
  title?: string;
  emptyHint?: string;
}) {
  return (
    <section className="bg-surface border border-rule rounded-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="eyebrow">{title}</h3>
        <span className="text-[11px] font-mono tabnum text-ink-faint">
          {entries.length.toLocaleString()} event{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[12px] text-ink-muted">{emptyHint}</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${eventDot(e.eventType)}`} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-ink-strong font-medium truncate">{e.eventType}</span>
                  <span className="text-[11px] font-mono tabnum text-ink-faint shrink-0">{fmt(e.timestamp)}</span>
                </div>
                {e.detail && <p className="text-[12px] text-ink-muted mt-0.5 whitespace-pre-wrap break-words">{e.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
