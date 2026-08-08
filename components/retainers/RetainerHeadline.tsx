// The one-line answer to "is anything wrong?", stated in words.
//
// This replaced a row of four stat cards. With one live retainer and no open
// requests those cards rendered four large zeros — the loudest element on the
// page carrying no information. A count is only worth a number when it is not
// zero; when everything is fine the right design is quiet.

type Props = {
  liveCount: number;
  unanswered: number;
  breached: number;
  atRisk: number;
  noPlan: number;
  overHours: number;
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function RetainerHeadline({
  liveCount,
  unanswered,
  breached,
  atRisk,
  noPlan,
  overHours,
}: Props) {
  const urgent = breached > 0;
  const warn = !urgent && (atRisk > 0 || overHours > 0);

  const tone = urgent
    ? { border: "border-red/30", dot: "bg-red", text: "text-red" }
    : warn
      ? { border: "border-amber/30", dot: "bg-amber", text: "text-amber" }
      : { border: "border-rule", dot: "bg-emerald", text: "text-emerald" };

  const headline = urgent
    ? `${plural(breached, "request is", "requests are")} past the agreed response time`
    : atRisk > 0
      ? `${plural(atRisk, "request is", "requests are")} close to the deadline`
      : unanswered > 0
        ? `${plural(unanswered, "request is", "requests are")} waiting on a first reply`
        : liveCount === 0
          ? "No active retainers"
          : liveCount === 1
            ? "The active retainer is within its response times"
            : `All ${liveCount} retainers are within their response times`;

  // Only facts worth acting on. A zero is never listed.
  const notes: string[] = [];
  if (urgent && atRisk > 0) notes.push(`${atRisk} more close to the deadline`);
  if (urgent && unanswered > breached) {
    notes.push(`${unanswered} unanswered in total`);
  }
  if (overHours > 0) {
    notes.push(`${plural(overHours, "retainer is", "retainers are")} over plan hours`);
  }
  if (noPlan > 0) {
    notes.push(
      `${plural(noPlan, "retainer has", "retainers have")} no plan, so nothing is measured`,
    );
  }

  return (
    <section
      className={`bg-surface border ${tone.border} rounded-card px-4 py-3.5 mb-5 flex items-start gap-3`}
      aria-live="polite"
    >
      <span
        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${tone.dot}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className={`text-[14px] font-medium leading-snug ${tone.text}`}>{headline}</p>
        {notes.length > 0 && (
          <p className="text-[12px] text-ink-muted mt-1 leading-snug">{notes.join(" · ")}</p>
        )}
      </div>
    </section>
  );
}
