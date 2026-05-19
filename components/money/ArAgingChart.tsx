"use client";

type Bucket = { label: string; total: number; count: number; min: number; max: number };

type Props = {
  buckets: Bucket[];
  onBucketClick: (min: number, max: number) => void;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// Color per bucket — green = current, red = overdue (target screenshot pattern)
const TONE: Record<string, { bar: string; text: string }> = {
  "0–30 days": { bar: "bg-emerald", text: "text-emerald" },
  "30–60 days": { bar: "bg-amber", text: "text-amber" },
  "60–90 days": { bar: "bg-red/70", text: "text-red" },
  "90+ days": { bar: "bg-red", text: "text-red" },
};

export function ArAgingChart({ buckets, onBucketClick }: Props) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const total = buckets.reduce((s, b) => s + b.total, 0);

  return (
    <div className="bg-surface rounded-card border border-rule p-5">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="eyebrow">AR Aging</h3>
        <div className="text-[12px] text-ink-muted tabnum font-mono">
          <span className="text-ink-strong">{fmtCurrency(total)}</span> outstanding
        </div>
      </div>
      <div className="space-y-3">
        {buckets.map((b) => {
          const widthPct = (b.total / max) * 100;
          const tone = TONE[b.label] ?? { bar: "bg-ink-muted", text: "text-ink" };
          return (
            <button
              key={b.label}
              type="button"
              onClick={() => onBucketClick(b.min, b.max)}
              className="w-full text-left group"
            >
              <div className="grid grid-cols-[80px_1fr_90px_28px] sm:grid-cols-[100px_1fr_100px_40px] items-center gap-2 sm:gap-3">
                <span className={`text-[11px] sm:text-[12px] font-medium ${tone.text}`}>
                  {b.label}
                </span>
                <div className="h-5 sm:h-6 bg-bg rounded-sm overflow-hidden relative">
                  <div
                    className={`h-full ${tone.bar} transition-all`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-[12px] sm:text-[13px] text-ink-strong font-semibold tabnum text-right">
                  {fmtCurrency(b.total)}
                </span>
                <span className="text-[10px] sm:text-[11px] text-ink-faint tabnum font-mono text-right">
                  {b.count}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
