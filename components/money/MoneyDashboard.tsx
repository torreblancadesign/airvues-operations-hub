"use client";

import { useMemo, useState } from "react";
import { MoneyInvoice } from "@/lib/money";
import { StatCard } from "@/components/ui/StatCard";
import { FilterBar } from "./FilterBar";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceSheet } from "./InvoiceSheet";
import { ArAgingChart } from "./ArAgingChart";
import { MonthlyFocus } from "./MonthlyFocus";
import { DEFAULT_SORT, EMPTY_FILTER, Filter, Sort, StatusBucket } from "./types";

type Props = {
  invoices: MoneyInvoice[];
  initialFilter?: Partial<Filter>;
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

export function MoneyDashboard({ invoices, initialFilter }: Props) {
  const [filter, setFilter] = useState<Filter>({ ...EMPTY_FILTER, ...initialFilter });
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [selected, setSelected] = useState<MoneyInvoice | null>(null);

  const payers = useMemo(() => {
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
    let mrr = 0;
    let mtdRevenue = 0;
    let mtdPaidCount = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    for (const r of invoices) {
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
      if (r.status && ["open", "sent", "unsent", "past due"].includes(r.status)) {
        open += r.amount;
        openCount += 1;
      }
      if (r.type === "Recurring" && (r.status === "subscribed" || r.status === "send subscription link" || r.status === "paid")) {
        mrr += r.amount;
      }
    }
    const avgInvoice = paidCount > 0 ? totalRevenue / paidCount : 0;
    const marginPct = totalRevenue > 0 ? (totalMarginProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalMarginProfit, totalOverhead, paidCount, open, openCount, mrr, avgInvoice, marginPct, mtdRevenue, mtdPaidCount };
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
      {/* Filter bar at top */}
      <FilterBar
        filter={filter}
        setFilter={setFilter}
        payers={payers}
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

      {/* Outstanding + MRR row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <StatCard
          label="Outstanding"
          tone="red"
          value={fmtCurrency(kpis.open)}
          sub={`${kpis.openCount} unpaid invoices`}
          active={filter.status === "open"}
          onClick={() => setStatus("open")}
        />
        <StatCard
          label="MRR"
          tone="sky"
          value={fmtCurrency(kpis.mrr)}
          sub="Recurring · subscribed"
        />
      </div>

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
