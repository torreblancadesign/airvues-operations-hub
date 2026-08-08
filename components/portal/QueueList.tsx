import Link from "next/link";
import { Pill, fmtHours } from "./bits";

export type QueueRow = {
  id: string;
  title: string;
  position: number;
  priority: string;
  requestedBy: string;
  askedOn: string;
  waitedHours: number | null;
  promisedHours: number | null;
  late: boolean;
};

/** The queue, and the designed empty state that stands in for it.
 *  A new client sees the empty state far more often than the list, so it is
 *  built as a real panel rather than a shrug. */
export function QueueList({
  entries,
  emptyTitle,
  emptyBody,
  emptyAction,
}: {
  entries: QueueRow[];
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: { href: string; label: string };
}) {
  if (entries.length === 0) {
    return (
      <div className="p-panel px-6 py-10 text-center">
        <p style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>{emptyTitle}</p>
        <p className="t-body mt-2 mx-auto" style={{ maxWidth: 380, lineHeight: 1.6 }}>
          {emptyBody}
        </p>
        {emptyAction && (
          <Link href={emptyAction.href} className="p-btn p-btn-primary mt-5">
            {emptyAction.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="p-panel p-rows overflow-hidden">
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={`/portal/requests/${e.id}`} className="p-row">
            <span
              className="fig shrink-0 text-right"
              style={{
                fontSize: "var(--t-sm)",
                fontWeight: 600,
                color: "var(--p-ink-3)",
                width: 18,
                paddingTop: 2,
              }}
              aria-label={`Position ${e.position}`}
            >
              {e.position}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block truncate"
                style={{ fontSize: "var(--t-md)", fontWeight: 550, letterSpacing: "-0.01em" }}
              >
                {e.title}
              </span>
              <span className="block t-fine fig mt-0.5">
                {e.priority} · {e.requestedBy} asked {e.askedOn}
                {/* Below 0.1 business hours the clock has barely started (or it is
                    outside business hours) — "waiting 0h" reads broken, so the
                    clause waits until there is something to say. */}
                {e.waitedHours !== null && e.waitedHours >= 0.1 && (
                  <>
                    {` · waiting ${fmtHours(e.waitedHours)}h`}
                    {e.promisedHours !== null && ` of ${e.promisedHours}h`}
                  </>
                )}
              </span>
            </span>
            <span className="shrink-0" style={{ paddingTop: 2 }}>
              <Pill tone={e.late ? "bad" : "info"}>{e.late ? "Overdue" : "Awaiting reply"}</Pill>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
