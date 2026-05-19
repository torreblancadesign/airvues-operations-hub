"use client";

import { useMemo, useState } from "react";
import { PipelineQuote } from "@/lib/pipeline";
import { StatCard } from "@/components/ui/StatCard";
import { PipelineFilterBar } from "./FilterBar";
import { QuoteTable } from "./QuoteTable";
import { QuoteSheet } from "./QuoteSheet";
import { DEFAULT_SORT, EMPTY_FILTER, Filter, Sort, StageBucket } from "./types";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const STAGE_STATUSES: Record<StageBucket, string[]> = {
  all: [],
  draft: ["Draft"],
  sent: ["Sent. Awaiting Approval."],
  signed: ["Approved and Signed", "Awaiting Payment", "Project In Progress"],
  paid: ["Paid"],
  lost: ["Cancelled", "Rejected"],
  auditing: ["Auditing 🚩"],
};

function daysSince(iso: string | null): number {
  if (!iso) return -1;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function applyFilter(rows: PipelineQuote[], f: Filter): PipelineQuote[] {
  return rows.filter((r) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${r.projectName} ${r.client} ${r.preparedBy} ${r.autonumber ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.stage !== "all") {
      const allowed = STAGE_STATUSES[f.stage];
      if (!r.status || !allowed.includes(r.status)) return false;
    }
    if (f.proposalType !== "all" && r.proposalType !== f.proposalType) return false;
    if (f.client && r.client !== f.client) return false;
    if (f.preparedBy && r.preparedBy !== f.preparedBy) return false;
    if (f.from && r.preparedDate && r.preparedDate < f.from) return false;
    if (f.to && r.preparedDate && r.preparedDate > f.to) return false;
    if (f.stalledOnly) {
      const days = daysSince(r.preparedDate);
      const isOpen = r.status === "Sent. Awaiting Approval." || r.status === "Draft" || r.status === "Auditing 🚩";
      if (!(isOpen && days > 14)) return false;
    }
    return true;
  });
}

function applySort(rows: PipelineQuote[], s: Sort): PipelineQuote[] {
  const dir = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (s.key) {
      case "preparedDate":
        av = a.preparedDate ?? "";
        bv = b.preparedDate ?? "";
        break;
      case "totalCost":
        av = a.totalCost;
        bv = b.totalCost;
        break;
      case "client":
        av = a.client.toLowerCase();
        bv = b.client.toLowerCase();
        break;
      case "status":
        av = a.status ?? "";
        bv = b.status ?? "";
        break;
      case "autonumber":
        av = a.autonumber ?? 0;
        bv = b.autonumber ?? 0;
        break;
      case "daysSinceSent":
        av = daysSince(a.preparedDate);
        bv = daysSince(b.preparedDate);
        break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

type Props = { quotes: PipelineQuote[] };

export function PipelineDashboard({ quotes }: Props) {
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [selected, setSelected] = useState<PipelineQuote | null>(null);

  const clients = useMemo(() => {
    const s = new Set<string>();
    for (const q of quotes) if (q.client) s.add(q.client);
    return Array.from(s).sort();
  }, [quotes]);

  const preparers = useMemo(() => {
    const s = new Set<string>();
    for (const q of quotes) if (q.preparedBy && q.preparedBy !== "—") s.add(q.preparedBy);
    return Array.from(s).sort();
  }, [quotes]);

  const kpis = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    let pipelineDollars = 0;
    let pipelineCount = 0;
    let stalledDollars = 0;
    let stalledCount = 0;
    let wonYtd = 0;
    let wonYtdCount = 0;
    let sentCount = 0;
    let paidCount = 0;
    let signedCount = 0;
    let avgVelocityDays = 0;
    let velocitySamples = 0;
    let lostCount = 0;

    for (const q of quotes) {
      const days = daysSince(q.preparedDate);
      const isOpen =
        q.status === "Sent. Awaiting Approval." ||
        q.status === "Draft" ||
        q.status === "Auditing 🚩" ||
        q.status === "Approved and Signed" ||
        q.status === "Awaiting Payment" ||
        q.status === "Project In Progress";

      if (isOpen && q.status !== "Paid") {
        pipelineDollars += q.totalCost;
        pipelineCount += 1;
      }

      if ((q.status === "Sent. Awaiting Approval." || q.status === "Draft" || q.status === "Auditing 🚩") && days > 14) {
        stalledDollars += q.totalCost;
        stalledCount += 1;
      }

      if (q.status === "Paid") {
        paidCount += 1;
        if (q.preparedDate && q.preparedDate >= yearStart) {
          wonYtd += q.totalCost;
          wonYtdCount += 1;
        }
        if (q.preparedDate && q.signedDate) {
          const dStart = new Date(q.preparedDate).getTime();
          const dEnd = new Date(q.signedDate).getTime();
          const diff = Math.floor((dEnd - dStart) / 86_400_000);
          if (diff >= 0) {
            avgVelocityDays += diff;
            velocitySamples += 1;
          }
        }
      }

      if (
        q.status === "Sent. Awaiting Approval." ||
        q.status === "Approved and Signed" ||
        q.status === "Awaiting Payment" ||
        q.status === "Project In Progress" ||
        q.status === "Paid"
      ) {
        sentCount += 1;
      }

      if (
        q.status === "Approved and Signed" ||
        q.status === "Awaiting Payment" ||
        q.status === "Project In Progress" ||
        q.status === "Paid"
      ) {
        signedCount += 1;
      }

      if (q.status === "Cancelled" || q.status === "Rejected") lostCount += 1;
    }

    const conversion = sentCount > 0 ? (paidCount / sentCount) * 100 : 0;
    const avgVelocity = velocitySamples > 0 ? avgVelocityDays / velocitySamples : 0;

    return { pipelineDollars, pipelineCount, stalledDollars, stalledCount, wonYtd, wonYtdCount, sentCount, paidCount, signedCount, conversion, avgVelocity, lostCount };
  }, [quotes]);

  const stageBreakdown = useMemo(() => {
    const bins: Record<string, { count: number; total: number }> = {};
    for (const q of quotes) {
      const key = q.status ?? "—";
      if (!bins[key]) bins[key] = { count: 0, total: 0 };
      bins[key].count += 1;
      bins[key].total += q.totalCost;
    }
    return Object.entries(bins).map(([status, v]) => ({ status, ...v })).sort((a, b) => b.total - a.total);
  }, [quotes]);

  const filtered = useMemo(() => applyFilter(quotes, filter), [quotes, filter]);
  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort]);
  const filteredTotal = filtered.reduce((s, r) => s + r.totalCost, 0);

  const setStage = (stage: StageBucket) => setFilter({ ...EMPTY_FILTER, stage });
  const setStalled = () => setFilter({ ...EMPTY_FILTER, stalledOnly: true });

  const goalTarget = 500_000;
  const goalPct = (kpis.wonYtd / goalTarget) * 100;

  // Color per status for stage breakdown bars
  const stageBarColor = (status: string): string => {
    if (status === "Paid") return "bg-emerald";
    if (status === "Approved and Signed" || status === "Awaiting Payment" || status === "Project In Progress") return "bg-sky";
    if (status === "Sent. Awaiting Approval." || status === "Draft") return "bg-amber";
    if (status === "Cancelled" || status === "Rejected") return "bg-red/70";
    if (status === "Auditing 🚩") return "bg-violet";
    return "bg-ink-muted";
  };
  const stageMaxTotal = Math.max(1, ...stageBreakdown.map((b) => b.total));

  return (
    <>
      <PipelineFilterBar
        filter={filter}
        setFilter={setFilter}
        clients={clients}
        preparers={preparers}
        totalCount={quotes.length}
        filteredCount={filtered.length}
      />

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <StatCard label="YTD Won" tone="emerald" value={fmtCurrency(kpis.wonYtd)} sub={`${kpis.wonYtdCount} quotes · ${goalPct.toFixed(1)}% of $500k`} />
        <StatCard label="Pipeline $" tone="sky" value={fmtCurrency(kpis.pipelineDollars)} sub={`${kpis.pipelineCount} open quotes`} />
        <StatCard label="Stalled" tone="red" value={fmtCurrency(kpis.stalledDollars)} sub={`${kpis.stalledCount} quotes > 14d`} active={filter.stalledOnly} onClick={setStalled} />
        <StatCard label="Quote → Paid" tone="emerald" value={`${kpis.conversion.toFixed(0)}%`} sub={`${kpis.paidCount} paid / ${kpis.sentCount} sent`} />
        <StatCard label="Avg velocity" tone="neutral" value={`${kpis.avgVelocity.toFixed(1)}d`} sub={`Prepared → Signed`} />
      </div>

      {/* KPIs row 2 — stage buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Draft" tone="neutral" value={(stageBreakdown.find((s) => s.status === "Draft")?.count ?? 0).toString()} sub={fmtCurrency(stageBreakdown.find((s) => s.status === "Draft")?.total ?? 0)} active={filter.stage === "draft"} onClick={() => setStage("draft")} />
        <StatCard label="Sent · awaiting" tone="amber" value={(stageBreakdown.find((s) => s.status === "Sent. Awaiting Approval.")?.count ?? 0).toString()} sub={fmtCurrency(stageBreakdown.find((s) => s.status === "Sent. Awaiting Approval.")?.total ?? 0)} active={filter.stage === "sent"} onClick={() => setStage("sent")} />
        <StatCard label="Signed (active)" tone="sky" value={(stageBreakdown.filter((s) => ["Approved and Signed", "Awaiting Payment", "Project In Progress"].includes(s.status)).reduce((a, b) => a + b.count, 0)).toString()} sub={fmtCurrency(stageBreakdown.filter((s) => ["Approved and Signed", "Awaiting Payment", "Project In Progress"].includes(s.status)).reduce((a, b) => a + b.total, 0))} active={filter.stage === "signed"} onClick={() => setStage("signed")} />
        <StatCard label="Paid" tone="emerald" value={kpis.paidCount.toString()} sub={fmtCurrency(stageBreakdown.find((s) => s.status === "Paid")?.total ?? 0)} active={filter.stage === "paid"} onClick={() => setStage("paid")} />
        <StatCard label="Lost" tone="red" value={kpis.lostCount.toString()} sub="Cancelled / Rejected" active={filter.stage === "lost"} onClick={() => setStage("lost")} />
      </div>

      {/* Stage breakdown bar chart */}
      <div className="bg-surface rounded-card border border-rule p-5 mb-6">
        <div className="flex items-baseline justify-between mb-5">
          <h3 className="eyebrow">Stage breakdown — $ by status</h3>
          <div className="text-[12px] text-ink-muted tabnum font-mono">
            <span className="text-ink-strong">{quotes.length}</span> total quotes
          </div>
        </div>
        <div className="space-y-2">
          {stageBreakdown.map((b) => {
            const widthPct = (b.total / stageMaxTotal) * 100;
            return (
              <div key={b.status} className="grid grid-cols-[120px_1fr_90px_28px] sm:grid-cols-[180px_1fr_120px_40px] items-center gap-2 sm:gap-3">
                <span className="text-[11px] sm:text-[12px] text-ink truncate">{b.status}</span>
                <div className="h-4 sm:h-5 bg-bg rounded-sm overflow-hidden">
                  <div className={`h-full ${stageBarColor(b.status)}`} style={{ width: `${widthPct}%` }} />
                </div>
                <span className="text-[11px] sm:text-[12px] text-ink-strong font-semibold tabnum text-right">{fmtCurrency(b.total)}</span>
                <span className="text-[10px] sm:text-[11px] text-ink-faint tabnum font-mono text-right">{b.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter result total */}
      {(filter.search || filter.stage !== "all" || filter.proposalType !== "all" || filter.client || filter.preparedBy || filter.from || filter.to || filter.stalledOnly) && (
        <div className="mb-3 text-[12px] text-ink-muted">
          Filtered total: <span className="text-ink-strong font-semibold tabnum">{fmtCurrency(filteredTotal)}</span>
        </div>
      )}

      <QuoteTable rows={sorted} sort={sort} setSort={setSort} onRowClick={setSelected} selectedId={selected?.id ?? null} />

      <QuoteSheet
        quote={selected}
        onClose={() => setSelected(null)}
        onFilterByClient={(client) => {
          setFilter({ ...EMPTY_FILTER, client });
          setSelected(null);
        }}
      />
    </>
  );
}
