"use client";

import { useMemo, useState } from "react";
import { MoneyInvoice } from "@/lib/money";
import type { PayerOption } from "@/lib/people-light";
import type { QuoteOption } from "@/lib/quotes-light";
import { StatCard } from "@/components/ui/StatCard";
import { FilterBar } from "./FilterBar";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceSheet } from "./InvoiceSheet";
import { ArAgingChart } from "./ArAgingChart";
import { MonthlyFocus } from "./MonthlyFocus";
import { NewInvoiceModal } from "./NewInvoiceModal";
import { DEFAULT_SORT, EMPTY_FILTER, Filter, Sort, StatusBucket } from "./types";

type Props = {
  invoices: MoneyInvoice[];
  initialFilter?: Partial<Filter>;
  canEdit?: boolean;
  payers?: PayerOption[];
  quotes?: QuoteOption[];
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const STATUS_GROUPS: Record<StatusBucket, string[]> = {
  all: [],
  paid: ["paid"],
  open: ["open", "sent", "unsent"],
  overdue: ["past due"],
  subscribed: ["subscribed", "send subscription link"],
  void: ["void", "Canceled", "Refunded", "failed"],
};

function applyFilter(rows: MoneyInvoice[], f: Filter): MoneyInvoice[] {
  return rows.filter((r) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${r.invoiceId ?? ""} ${r.payer} ${r.description ?? ""} ${r.identifier}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status !== "all") {
      const allowed = STATUS_GROUPS[f.status];
      if (!r.status || !allowed.includes(r.status)) return false;
    }
    if (f.source !== "all" && r.source !== f.source) return false;
    if (f.type !== "all" && r.type !== f.type) return false;
    if (f.payer && r.payer !== f.payer) return false;
    if (f.from && r.date && r.date < f.from) return false;
    if (f.to && r.date && r.date > f.to) return false;
    return true;
  });
}

function applySort(rows: MoneyInvoice[], s: Sort): MoneyInvoice[] {
  const dir = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (s.key) {
      case "date":
        av = a.date ?? "";
        bv = b.date ?? "";
        break;
      case "amount":
        av = a.amount;
        bv = b.amount;
        break;
      case "payer":
        av = a.payer.toLowerCase();
        bv = b.payer.toLowerCase();
        break;
      case "status":
        av = a.status ?? "";
        bv = b.status ?? "";
        break;
      case "invoiceId":
        av = a.invoiceId ?? 0;
        bv = b.invoiceId ?? 0;
        break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function arAgingBuckets(rows: MoneyInvoice[]) {
  const now = Date.now();
  const buckets = [
    { label: "0–30 days", min: 0, max: 30, total: 0, count: 0 },
    { label: "30–60 days", min: 30, max: 60, total: 0, count: 0 },
    { label: "60–90 days", min: 60, max: 90, total: 0, count: 0 },
    { label: "90+ days", min: 90, max: Infinity, total: 0, count: 0 },
  ];
  const openish = ["open", "sent", "unsent", "past due"];
  for (const r of rows) {
    if (!r.status || !openish.includes(r.status)) continue;
    if (!r.date) continue;
    const days = Math.floor((now - new Date(r.date).getTime()) / 86_400_000);
    const b = buckets.find((x) => days >= x.min && days < x.max);
    if (!b) continue;
    b.total += r.amount;
    b.count += 1;
  }
  return buckets;
}

export function MoneyDashboard({
  invoices,
  initialFilter,
  canEdit = false,
  payers = [],
  quotes = [],
}: Props) {
  const [filter, setFilter] = useState<Filter>({ ...EMPTY_FILTER, ...initialFilter });
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [selected, setSelected] = useState<MoneyInvoice | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [paidScope, setPaidScope] = useState<"mtd" | "ytd">("mtd");

  const payerNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of invoices) set.add(r.payer);
    return Array.from(set).sort();
  }, [invoices]);


  // KPIs against unfiltered base
  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let totalMarginProfit = 0;
    let totalOverhead = 0;
    let paidCount = 0;
    let open = 0;
    let openCount = 0;
    let unpaidCurrent = 0;
    let unpaidCurrentCount = 0;
    let lateAmount = 0;
    let lateCount = 0;
    let mrr = 0;
    let mtdRevenue = 0;
    let mtdPaidCount = 0;
    const typeCounts = { "One-time": 0, Recurring: 0, "Payment Plan": 0 } as Record<string, number>;
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    for (const r of invoices) {
      if (r.type && typeCounts[r.type] != null) typeCounts[r.type] += 1;
      if (r.status === "paid") {
        totalRevenue += r.amount;
        totalMarginProfit += r.marginProfit ?? 0;
        totalOverhead += r.amount * 0.2;
        paidCount += 1;
        if (r.date) {
          const d = new Date(r.date);
          if (d >= monthStart && d < monthEnd) {
            mtdRevenue += r.amount;
            mtdPaidCount += 1;
          }
        }
      }
      const isOpenish = r.status && ["open", "sent", "unsent", "past due"].includes(r.status);
      if (isOpenish) {
        open += r.amount;
        openCount += 1;
        const overdue = r.status === "past due" || (r.date != null && r.date < todayISO);
        if (overdue) {
          lateAmount += r.amount;
          lateCount += 1;
        } else {
          unpaidCurrent += r.amount;
          unpaidCurrentCount += 1;
        }
      }
      if (r.type === "Recurring" && (r.status === "subscribed" || r.status === "send subscription link" || r.status === "paid")) {
        mrr += r.amount;
      }
    }
    const avgInvoice = paidCount > 0 ? totalRevenue / paidCount : 0;
    const marginPct = totalRevenue > 0 ? (totalMarginProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalMarginProfit, totalOverhead, paidCount, open, openCount, unpaidCurrent, unpaidCurrentCount, lateAmount, lateCount, typeCounts, mrr, avgInvoice, marginPct, mtdRevenue, mtdPaidCount };
  }, [invoices]);

  // Next 30 days of unpaid invoices, sorted by due date.
  const upcoming = useMemo(() => {
    const now = Date.now();
    const horizon = now + 30 * 86_400_000;
    return invoices
      .filter((r) => {
        if (!r.status || !["open", "sent", "unsent"].includes(r.status)) return false;
        if (!r.date) return false;
        const t = new Date(r.date).getTime();
        return t >= now - 86_400_000 && t <= horizon;
      })
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))
      .slice(0, 8);
  }, [invoices]);

  const aging = useMemo(() => arAgingBuckets(invoices), [invoices]);

  const filtered = useMemo(() => applyFilter(invoices, filter), [invoices, filter]);
  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort]);
  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0);

  const setStatus = (status: StatusBucket) => setFilter({ ...EMPTY_FILTER, status });

  const setBucketFilter = (minDays: number, maxDays: number) => {
    const now = new Date();
    const toDate = new Date(now.getTime() - minDays * 86_400_000).toISOString().slice(0, 10);
    const fromDate = isFinite(maxDays)
      ? new Date(now.getTime() - maxDays * 86_400_000).toISOString().slice(0, 10)
      : null;
    setFilter({ ...EMPTY_FILTER, status: "open", from: fromDate, to: toDate });
  };

  return (
    <>
      {/* Header action: New invoice */}
      {canEdit && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors inline-flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New invoice
          </button>
        </div>
      )}

      {/* Hero strip — Outstanding AR + Paid (MTD/YTD) */}
      <HeroStrip
        kpis={kpis}
        invoices={invoices}
        paidScope={paidScope}
        setPaidScope={setPaidScope}
      />

      {/* Filter bar at top */}
      <FilterBar
        filter={filter}
        setFilter={setFilter}
        payers={payerNames}
        totalCount={invoices.length}
        filteredCount={filtered.length}
      />

      {/* This Month focus — MTD revenue, MRR, monthly goal bars */}
      <MonthlyFocus
        mtdRevenue={kpis.mtdRevenue}
        mtdPaidCount={kpis.mtdPaidCount}
        mrr={kpis.mrr}
      />


      {/* All-time section header */}
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] font-semibold text-ink-strong uppercase tracking-wider">All Time</h2>
        <span className="font-mono text-[11px] text-ink-faint tabnum">Since inception</span>
      </div>



      {/* KPI strip — 5 colored cards (matches target screenshot) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <StatCard
          label="Total Revenue"
          tone="emerald"
          value={fmtCurrency(kpis.totalRevenue)}
          sub={`${kpis.paidCount} invoices`}
        />
        <StatCard
          label="Gross Margin (rollup)"
          tone="emerald"
          value={fmtCurrency(kpis.totalMarginProfit)}
          sub={`${kpis.marginPct.toFixed(1)}% per Airtable rollup · not net-of-engineer-pay`}
        />
        <StatCard
          label="Total Overhead"
          tone="amber"
          value={fmtCurrency(kpis.totalOverhead)}
          sub="20% of revenue"
        />
        <StatCard
          label="Avg Invoice"
          tone="neutral"
          value={fmtCurrency(kpis.avgInvoice)}
        />
        <StatCard
          label="Paid Invoices"
          tone="neutral"
          value={kpis.paidCount.toLocaleString()}
          sub={`of ${invoices.length} total`}
          active={filter.status === "paid"}
          onClick={() => setStatus("paid")}
        />
      </div>

      {/* Outstanding split — Unpaid (current) vs Late · MRR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <StatCard
          label="Unpaid (current)"
          tone="amber"
          value={fmtCurrency(kpis.unpaidCurrent)}
          sub={`${kpis.unpaidCurrentCount} invoices · not yet past due`}
          active={filter.status === "open"}
          onClick={() => setStatus("open")}
        />
        <StatCard
          label="Late"
          tone="red"
          value={fmtCurrency(kpis.lateAmount)}
          sub={`${kpis.lateCount} past due`}
          active={filter.status === "overdue"}
          onClick={() => setStatus("overdue")}
        />
        <StatCard
          label="MRR"
          tone="sky"
          value={fmtCurrency(kpis.mrr)}
          sub="Recurring · subscribed"
        />
      </div>

      {/* Invoice type mix strip */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="font-mono uppercase tracking-wider text-ink-faint">Invoice mix:</span>
        <span>
          <span className="text-ink-strong tabnum">{kpis.typeCounts["One-time"] ?? 0}</span> one-time
        </span>
        <span>
          <span className="text-ink-strong tabnum">{kpis.typeCounts["Recurring"] ?? 0}</span> recurring
        </span>
        <span>
          <span className="text-ink-strong tabnum">{kpis.typeCounts["Payment Plan"] ?? 0}</span> payment plan
        </span>
      </div>

      {/* Upcoming Payments — next 30 days, unpaid */}
      {upcoming.length > 0 && (
        <div className="mb-4 bg-surface border border-rule rounded-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-rule flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-strong">
              Upcoming Payments · next 30 days
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint tabnum">
              {upcoming.length} due
            </span>
          </div>
          <table className="w-full">
            <thead className="bg-bg-elevated border-b border-rule">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Payer</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Due</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">In</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((r) => {
                const days = r.date ? Math.ceil((new Date(r.date).getTime() - Date.now()) / 86_400_000) : null;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="border-b border-rule-soft last:border-0 cursor-pointer hover:bg-bg-elevated transition-colors"
                  >
                    <td className="px-3 py-2 text-[12px] text-ink-strong max-w-[280px] truncate">{r.payer}</td>
                    <td className="px-3 py-2 text-[11px] font-mono tabnum text-ink-muted">
                      {r.date ? new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right text-[11px] font-mono tabnum ${days != null && days <= 7 ? "text-amber" : "text-ink-muted"}`}>
                      {days != null ? `${days}d` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] font-semibold text-ink-strong tabnum">
                      {fmtCurrency(r.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AR Aging horizontal bar chart */}
      <div className="mb-6">
        <ArAgingChart buckets={aging} onBucketClick={setBucketFilter} />
      </div>

      {/* Filter result total */}
      {(filter.search ||
        filter.status !== "all" ||
        filter.source !== "all" ||
        filter.type !== "all" ||
        filter.payer ||
        filter.from ||
        filter.to) && (
        <div className="mb-3 text-[12px] text-ink-muted">
          Filtered total:{" "}
          <span className="text-ink-strong font-semibold tabnum">{fmtCurrency(filteredTotal)}</span>
        </div>
      )}

      {/* Main table */}
      <InvoiceTable
        rows={sorted}
        sort={sort}
        setSort={setSort}
        onRowClick={setSelected}
        selectedId={selected?.id ?? null}
      />

      {/* Drill-in sheet */}
      <InvoiceSheet
        invoice={selected}
        onClose={() => setSelected(null)}
        onFilterByPayer={(payer) => {
          setFilter({ ...EMPTY_FILTER, payer });
          setSelected(null);
        }}
      />
    </>
  );
}
