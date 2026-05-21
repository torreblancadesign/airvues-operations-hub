"use client";

import { Lead } from "@/lib/leads";

type Props = { leads: Lead[] };

function Row({ label, count, total, sold }: { label: string; count: number; total: number; sold?: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const conv = sold != null && count > 0 ? (sold / count) * 100 : null;
  return (
    <div className="grid grid-cols-[1fr_44px_56px] items-center gap-2 py-1.5">
      <div>
        <div className="text-[12px] text-ink">{label}</div>
        <div className="h-1.5 bg-bg rounded-sm overflow-hidden mt-1">
          <div className="h-full bg-emerald/60" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[12px] text-ink-strong font-mono tabnum text-right">{count}</span>
      <span className="text-[11px] text-ink-muted font-mono tabnum text-right">
        {conv != null ? `${conv.toFixed(0)}% won` : `${pct.toFixed(0)}%`}
      </span>
    </div>
  );
}

export function SourceBudgetBreakdown({ leads }: Props) {
  const sources = new Map<string, { count: number; sold: number }>();
  const budgets = new Map<string, { count: number; sold: number }>();
  for (const l of leads) {
    const src = l.source ?? "—";
    const bud = l.budget ?? "—";
    if (!sources.has(src)) sources.set(src, { count: 0, sold: 0 });
    if (!budgets.has(bud)) budgets.set(bud, { count: 0, sold: 0 });
    const s = sources.get(src)!; s.count += 1; if (l.status === "Sold") s.sold += 1;
    const b = budgets.get(bud)!; b.count += 1; if (l.status === "Sold") b.sold += 1;
  }
  const total = leads.length;

  return (
    <div className="bg-surface rounded-card border border-rule p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="eyebrow mb-2">By source</h3>
          {Array.from(sources.entries()).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => (
            <Row key={k} label={k} count={v.count} total={total} sold={v.sold} />
          ))}
        </div>
        <div>
          <h3 className="eyebrow mb-2">By budget</h3>
          {Array.from(budgets.entries()).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => (
            <Row key={k} label={k} count={v.count} total={total} sold={v.sold} />
          ))}
        </div>
      </div>
    </div>
  );
}
