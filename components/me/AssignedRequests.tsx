// Dev inbox — retainer requests assigned to the person whose scorecard this is.
// Renders nothing when they have none, so it costs zero space for engineers who
// are not on a retainer.
import Link from "next/link";
import type { RetainerBoardRow, RetainerRequest } from "@/lib/retainer-types";

const chip =
  "inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider";

function priorityTone(p: string | null): string {
  if (p === "Urgent") return "bg-red/15 text-red";
  if (p === "High") return "bg-amber/15 text-amber";
  if (p === "Medium") return "bg-sky/15 text-sky";
  return "bg-bg-elevated text-ink-muted";
}

function outcomeTone(o: string | null): string {
  if (o === "Breached") return "bg-red/15 text-red";
  if (o === "Met") return "bg-emerald/15 text-emerald";
  if (o === "Pending") return "bg-sky/15 text-sky";
  return "bg-bg-elevated text-ink-faint";
}

/** en-US pinned — deadlines are contractual, not locale-flavoured. */
function due(iso: string | null): string {
  if (!iso) return "no deadline";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AssignedRequests({
  requests,
  retainerNames,
}: {
  requests: RetainerRequest[];
  retainerNames: Map<string, string>;
}) {
  if (requests.length === 0) return null;

  const unanswered = requests.filter((r) => !r.firstRespondedAt).length;

  return (
    <section className="bg-surface border border-rule rounded-card mb-5">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
        <div>
          <div className="eyebrow">Client requests assigned to you</div>
          <div className="text-[12px] text-ink-muted mt-0.5">
            {requests.length} open
            {unanswered > 0 && (
              <span className="text-amber"> · {unanswered} awaiting first response</span>
            )}
          </div>
        </div>
        <Link href="/retainers" className="text-[11px] text-ink-muted hover:text-ink-strong underline">
          All retainers →
        </Link>
      </div>
      <ul className="divide-y divide-rule/60">
        {requests.map((r) => (
          <li key={r.id}>
            {/* A request with no retainer link would render /retainers/null,
                which 404s. The label below already guards the same null. */}
            <Link
              href={
                r.retainerId ? `/retainers/${r.retainerId}?r=${r.id}` : "/retainers"
              }
              className="block px-4 py-2.5 hover:bg-bg-elevated"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] text-ink-strong truncate">{r.title}</div>
                <span className={`${chip} ${priorityTone(r.priority)}`}>{r.priority ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] text-ink-muted">
                  {(r.retainerId && retainerNames.get(r.retainerId)) ?? "—"}
                </span>
                <span className={`${chip} bg-bg-elevated text-ink-muted`}>{r.status ?? "—"}</span>
                <span className={`${chip} ${outcomeTone(r.slaOutcome)}`}>
                  {r.slaOutcome ?? "—"}
                </span>
                {!r.firstRespondedAt && (
                  <span className="text-[10px] text-ink-faint font-mono">due {due(r.slaDueAt)}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sort worst-first: unanswered before answered, then by deadline. */
export function sortForInbox(requests: RetainerRequest[]): RetainerRequest[] {
  return [...requests].sort((a, b) => {
    const au = a.firstRespondedAt ? 1 : 0;
    const bu = b.firstRespondedAt ? 1 : 0;
    if (au !== bu) return au - bu;
    const ad = a.slaDueAt ?? "9999";
    const bd = b.slaDueAt ?? "9999";
    return ad.localeCompare(bd);
  });
}

export type { RetainerBoardRow };
