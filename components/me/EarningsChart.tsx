"use client";

import { useEffect, useMemo, useState } from "react";
import { ScorecardPayment } from "@/lib/scorecard-types";

type Props = { payments: ScorecardPayment[] };
type Window = "12m" | "ytd" | "all";

type Bucket = {
  key: string;
  label: string;
  subLabel?: string;
  paid: number;
  owed: number;
  total: number;
  payments: ScorecardPayment[];
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtMoneyShort = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${n.toFixed(0)}`;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlyBuckets(payments: ScorecardPayment[], window: Window): Bucket[] {
  const now = new Date();
  const buckets = new Map<string, Bucket>();

  // Seed empty months for 12m / ytd so gaps render as zero bars
  if (window === "12m") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d);
      buckets.set(k, {
        key: k,
        label: d.toLocaleString("en-US", { month: "short" }),
        subLabel: d.getMonth() === 0 ? `'${String(d.getFullYear()).slice(-2)}` : undefined,
        paid: 0, owed: 0, total: 0, payments: [],
      });
    }
  } else if (window === "ytd") {
    for (let m = 0; m <= now.getMonth(); m++) {
      const d = new Date(now.getFullYear(), m, 1);
      const k = monthKey(d);
      buckets.set(k, {
        key: k,
        label: d.toLocaleString("en-US", { month: "short" }),
        paid: 0, owed: 0, total: 0, payments: [],
      });
    }
  }

  for (const p of payments) {
    if (!p.date) continue;
    const d = new Date(p.date);
    if (isNaN(d.getTime())) continue;

    if (window === "12m") {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      if (d < cutoff) continue;
    } else if (window === "ytd") {
      if (d.getFullYear() !== now.getFullYear()) continue;
    }

    const k = monthKey(d);
    let b = buckets.get(k);
    if (!b) {
      b = {
        key: k,
        label: d.toLocaleString("en-US", { month: "short" }),
        subLabel: d.getMonth() === 0 ? `'${String(d.getFullYear()).slice(-2)}` : undefined,
        paid: 0, owed: 0, total: 0, payments: [],
      };
      buckets.set(k, b);
    }
    if (p.status === "Paid") b.paid += p.amount;
    else if (p.status === "Needs Payment") b.owed += p.amount;
    b.total = b.paid + b.owed;
    b.payments.push(p);
  }

  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function buildYearlyBuckets(payments: ScorecardPayment[]): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const p of payments) {
    if (!p.date) continue;
    const d = new Date(p.date);
    if (isNaN(d.getTime())) continue;
    const k = String(d.getFullYear());
    let b = buckets.get(k);
    if (!b) {
      b = { key: k, label: k, paid: 0, owed: 0, total: 0, payments: [] };
      buckets.set(k, b);
    }
    if (p.status === "Paid") b.paid += p.amount;
    else if (p.status === "Needs Payment") b.owed += p.amount;
    b.total = b.paid + b.owed;
    b.payments.push(p);
  }
  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function EarningsChart({ payments }: Props) {
  const [window, setWindow] = useState<Window>("12m");
  const [selected, setSelected] = useState<Bucket | null>(null);

  const buckets = useMemo(
    () => (window === "all" ? buildYearlyBuckets(payments) : buildMonthlyBuckets(payments, window)),
    [payments, window],
  );

  const totals = useMemo(() => {
    let paid = 0, owed = 0;
    for (const b of buckets) {
      paid += b.paid;
      owed += b.owed;
    }
    return { paid, owed, total: paid + owed };
  }, [buckets]);

  const max = Math.max(1, ...buckets.map((b) => b.total));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (payments.length === 0) {
    return (
      <div className="bg-surface border border-dashed border-rule rounded-card p-5 text-[13px] text-ink-muted">
        No payments recorded yet.
      </div>
    );
  }

  const windowLabel = window === "12m" ? "Last 12 months" : window === "ytd" ? "Year to date" : "All time";

  return (
    <>
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        {/* Header: window toggle + totals */}
        <div className="px-5 py-4 border-b border-rule flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-[12px] font-mono tabnum">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-faint">Total · {windowLabel}</div>
              <div className="text-[16px] font-semibold text-ink-strong">{fmtMoney(totals.total)}</div>
            </div>
            <div className="text-ink-faint">·</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-emerald" />
              <span className="text-ink-muted">Paid</span>
              <span className="text-ink-strong font-semibold">{fmtMoney(totals.paid)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-amber" />
              <span className="text-ink-muted">Outstanding</span>
              <span className="text-ink-strong font-semibold">{fmtMoney(totals.owed)}</span>
            </div>
          </div>
          <div className="flex gap-1 bg-bg-elevated border border-rule rounded-md p-0.5">
            {(["12m", "ytd", "all"] as Window[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                className={`px-2.5 py-1 text-[11px] rounded font-mono uppercase tracking-wider ${
                  window === w ? "bg-emerald text-bg font-medium" : "text-ink-muted hover:text-ink-strong"
                }`}
              >
                {w === "12m" ? "12 mo" : w === "ytd" ? "YTD" : "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="px-5 py-6">
          {buckets.length === 0 ? (
            <div className="text-[13px] text-ink-muted text-center py-8">No payments in this window.</div>
          ) : (
            <div className="flex items-end gap-2 h-[200px]">
              {buckets.map((b) => {
                const pct = (b.total / max) * 100;
                const paidPct = b.total > 0 ? (b.paid / b.total) * 100 : 0;
                const owedPct = b.total > 0 ? (b.owed / b.total) * 100 : 0;
                const isSelected = selected?.key === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setSelected(b)}
                    disabled={b.total === 0}
                    className={`group flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0 ${
                      b.total === 0 ? "cursor-default" : "cursor-pointer"
                    }`}
                    title={b.total > 0 ? `${b.label}: ${fmtMoney(b.total)} (${b.payments.length} payment${b.payments.length === 1 ? "" : "s"})` : `${b.label}: no payments`}
                  >
                    {/* Amount label on hover */}
                    <span className={`text-[10px] font-mono tabnum transition-opacity ${
                      isSelected ? "text-emerald opacity-100" : "text-ink-muted opacity-0 group-hover:opacity-100"
                    } ${b.total === 0 ? "group-hover:opacity-0" : ""}`}>
                      {b.total > 0 ? fmtMoneyShort(b.total) : ""}
                    </span>

                    {/* Bar */}
                    <div className="w-full flex flex-col justify-end" style={{ height: `${Math.max(2, pct)}%`, minHeight: b.total > 0 ? 4 : 2 }}>
                      {b.total > 0 ? (
                        <>
                          {b.owed > 0 && (
                            <div
                              className={`w-full bg-amber transition-opacity ${isSelected ? "opacity-100" : "opacity-90 group-hover:opacity-100"}`}
                              style={{ height: `${owedPct}%` }}
                            />
                          )}
                          {b.paid > 0 && (
                            <div
                              className={`w-full bg-emerald transition-opacity ${isSelected ? "opacity-100" : "opacity-90 group-hover:opacity-100"}`}
                              style={{ height: `${paidPct}%` }}
                            />
                          )}
                        </>
                      ) : (
                        <div className="w-full h-[2px] bg-rule" />
                      )}
                    </div>

                    {/* X-axis label */}
                    <div className={`text-[10px] font-mono tabnum leading-tight ${isSelected ? "text-emerald" : "text-ink-faint"}`}>
                      <div>{b.label}</div>
                      {b.subLabel && <div className="text-[9px]">{b.subLabel}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drill-down side panel */}
      {selected && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelected(null)}
          />
          <aside className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-surface border-l border-rule z-50 flex flex-col shadow-2xl">
            <header className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
                  Earnings · {window === "all" ? "Year" : "Month"}
                </div>
                <div className="text-[18px] font-semibold text-ink-strong">
                  {window === "all"
                    ? selected.label
                    : new Date(selected.key + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[12px] font-mono tabnum">
                  <span className="text-emerald font-semibold">{fmtMoney(selected.total)}</span>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-muted">{selected.payments.length} payment{selected.payments.length === 1 ? "" : "s"}</span>
                </div>
                {selected.owed > 0 && (
                  <div className="mt-0.5 text-[11px] text-amber font-mono tabnum">
                    {fmtMoney(selected.owed)} outstanding
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-ink-muted hover:text-ink-strong text-[20px] leading-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-bg-elevated border-b border-rule sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Date</th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Client / project</th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...selected.payments]
                    .sort((a, b) => (a.date ?? "") < (b.date ?? "") ? 1 : -1)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-rule-soft last:border-0 hover:bg-bg-elevated">
                        <td className="px-4 py-2 text-[11px] font-mono tabnum text-ink-muted whitespace-nowrap">
                          {p.date ? new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td className="px-2 py-2 text-[12px] text-ink">
                          <a href={p.airtableUrl} target="_blank" rel="noopener noreferrer" className="text-ink-strong hover:text-emerald transition-colors">
                            {p.client ?? "—"}
                          </a>
                          {p.project && <div className="text-[10px] text-ink-faint truncate max-w-[240px]">{p.project}</div>}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.function && <span className="text-[10px] text-ink-faint">{p.function}</span>}
                            <span className={`inline-block px-1.5 py-0 rounded text-[9px] font-medium uppercase tracking-wider ${
                              p.status === "Paid" ? "bg-emerald-soft text-emerald" : "bg-amber-soft text-amber"
                            }`}>
                              {p.status ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-[13px] font-semibold text-ink-strong tabnum whitespace-nowrap align-top">
                          {fmtMoney(p.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
