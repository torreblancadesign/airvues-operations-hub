// The response record, drawn: one bar per answered request, in the order they
// were filed. Every bar is normalized to that request's OWN promised window,
// which is what lets a single dashed line stand for "the promise" across
// requests with different priorities — and is also what keeps the actual
// window figures (Owner-only commercial terms) off the axis.
import type { CSSProperties } from "react";

export type ChartBar = {
  id: string;
  /** Business hours to first reply, over the hours promised. 1 = exactly on time. */
  ratio: number;
  late: boolean;
  /** Full sentence for the hover title. */
  label: string;
};

/** Display cap: a 10× breach should read as "far over", not flatten the rest. */
const RATIO_CAP = 3;

export function ResponseChart({ bars }: { bars: ChartBar[] }) {
  const capped = bars.map((b) => ({ ...b, r: Math.min(b.ratio, RATIO_CAP) }));
  const max = Math.max(1.3, ...capped.map((b) => b.r * 1.12));
  const promiseBottom = (1 / max) * 100;

  return (
    <div
      className="p-chart"
      role="img"
      aria-label={`First reply time for the last ${bars.length} answered requests, each against the window promised for it`}
    >
      <div className="p-chart-promise" style={{ bottom: `${promiseBottom}%` }}>
        <span>promised reply time</span>
      </div>
      {capped.map((b) => {
        const style: CSSProperties = {
          height: `${Math.max((b.r / max) * 100, 5)}%`,
          background: b.late ? "var(--p-bad)" : "var(--p-ok)",
        };
        return <div key={b.id} className="p-chart-bar" title={b.label} style={style} />;
      })}
    </div>
  );
}
