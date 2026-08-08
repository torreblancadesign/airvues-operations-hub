"use client";

// Two small measurement displays shared by the retainer board and the detail
// page. Both render the number as well as the bar — the bar is a fast read,
// the number is the answer, and neither replaces the other.

export function fmtHours(h: number | null): string {
  if (h === null) return "—";
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/**
 * Hours logged against hours included this period.
 *
 * Over-budget is the finding that matters — it means the firm is working for
 * free — so it is the only state that takes a warning colour. Under-budget is
 * normal and stays quiet.
 */
export function HoursMeter({
  logged,
  included,
  className = "",
}: {
  logged: number | null;
  included: number | null;
  className?: string;
}) {
  if (included === null || included <= 0) {
    return (
      <div className={className}>
        <div className="tabnum text-[12px] text-ink">{fmtHours(logged)}</div>
        <div className="text-[10px] text-ink-faint">no plan hours</div>
      </div>
    );
  }

  const used = logged ?? 0;
  const ratio = used / included;
  const over = ratio > 1;
  const near = !over && ratio >= 0.85;
  const fill = over ? "bg-red" : near ? "bg-amber" : "bg-emerald";
  const text = over ? "text-red" : near ? "text-amber" : "text-ink";

  return (
    <div className={className}>
      <div className="flex items-baseline gap-1">
        <span className={`tabnum text-[12px] font-medium ${text}`}>{fmtHours(used)}</span>
        <span className="tabnum text-[11px] text-ink-faint">/ {fmtHours(included)}h</span>
      </div>
      <div
        className="mt-1 h-1 w-full rounded-full bg-rule/60 overflow-hidden"
        role="img"
        aria-label={`${fmtHours(used)} of ${fmtHours(included)} hours used this period`}
      >
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-300 ease-out`}
          style={{ width: `${Math.min(100, Math.max(ratio * 100, used > 0 ? 3 : 0))}%` }}
        />
      </div>
      {over && (
        <div className="text-[10px] text-red mt-0.5 tabnum">
          {fmtHours(used - included)}h over
        </div>
      )}
    </div>
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "Aug 16" from an ISO date. en-US pinned upstream; this avoids locale drift. */
function shortDay(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * Where we are inside the retainer's anniversary period. Hours used mean
 * nothing without it — 40 of 45 hours is fine on day 28 and alarming on day 3.
 */
export function PeriodMeter({
  start,
  end,
  now,
}: {
  start: string | null;
  end: string | null;
  now: number;
}) {
  if (!start || !end) {
    return <span className="text-[11px] text-ink-faint">no effective date</span>;
  }
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const span = e - s;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((now - s) / span) * 100)) : 0;
  const daysLeft = Math.max(0, Math.ceil((e - now) / 86_400_000));

  return (
    <div>
      <div className="tabnum text-[11px] text-ink-muted">
        {shortDay(start)} → {shortDay(end)}
      </div>
      <div className="mt-1 h-1 w-full rounded-full bg-rule/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-ink-faint/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-ink-faint mt-0.5 tabnum">
        {daysLeft === 0 ? "renews today" : `${daysLeft}d left`}
      </div>
    </div>
  );
}
