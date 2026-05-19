"use client";

import { useMemo, useState } from "react";
import { ClientRow } from "@/lib/clients";
import { StatCard } from "@/components/ui/StatCard";
import { ClientSheet } from "./ClientSheet";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type Bucket = "all" | "active" | "at-risk" | "occasional" | "iddle" | "lost" | "new" | "misclassified";

const ENGAGEMENT_COLOR: Record<string, string> = {
  Active: "bg-emerald-soft text-emerald",
  Occasional: "bg-sky-soft text-sky",
  Iddle: "bg-amber-soft text-amber",
  Lost: "bg-red-soft text-red",
  New: "bg-violet-soft text-violet",
  Archived: "bg-rule text-ink-faint",
};

const TIER = (monthly: number): { label: string; cls: string } => {
  // monthly retainer signal from contract type is weak — fallback to revenue / activity
  if (monthly >= 12_000) return { label: "Diamond", cls: "bg-violet-soft text-violet" };
  if (monthly >= 9_000) return { label: "Sapphire", cls: "bg-sky-soft text-sky" };
  if (monthly >= 5_000) return { label: "Premier", cls: "bg-emerald-soft text-emerald" };
  return { label: "Standard", cls: "bg-rule text-ink-muted" };
};

type SortKey = "name" | "lifetimeRevenue" | "outstandingAR" | "invoiceCount" | "daysSinceLastInvoice" | "engagement";
type Sort = { key: SortKey; dir: "asc" | "desc" };

export function ClientsDashboard({ clients }: { clients: ClientRow[] }) {
  const [bucket, setBucket] = useState<Bucket>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "lifetimeRevenue", dir: "desc" });
  const [selected, setSelected] = useState<ClientRow | null>(null);

  const kpis = useMemo(() => {
    let activeCount = 0;
    let atRiskCount = 0;
    let totalRevenue = 0;
    let totalOutstanding = 0;
    const sortedByRev = [...clients].sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);
    const top10Total = sortedByRev.slice(0, 10).reduce((s, c) => s + c.lifetimeRevenue, 0);
    let misclassified = 0;

    for (const c of clients) {
      totalRevenue += c.lifetimeRevenue;
      totalOutstanding += c.outstandingAR;
      if (c.engagement === "Active") {
        activeCount += 1;
        if (c.daysSinceLastInvoice != null && c.daysSinceLastInvoice > 90) atRiskCount += 1;
      }
      // misclassified: marked "New" but has lifetime revenue
      if (c.engagement === "New" && c.lifetimeRevenue > 1000) misclassified += 1;
    }
    const whalePct = totalRevenue > 0 ? (top10Total / totalRevenue) * 100 : 0;
    return { activeCount, atRiskCount, totalRevenue, totalOutstanding, top10Total, whalePct, misclassified };
  }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q)) return false;
      }
      switch (bucket) {
        case "all":
          return true;
        case "active":
          return c.engagement === "Active";
        case "at-risk":
          return c.engagement === "Active" && c.daysSinceLastInvoice != null && c.daysSinceLastInvoice > 90;
        case "occasional":
          return c.engagement === "Occasional";
        case "iddle":
          return c.engagement === "Iddle";
        case "lost":
          return c.engagement === "Lost";
        case "new":
          return c.engagement === "New";
        case "misclassified":
          return c.engagement === "New" && c.lifetimeRevenue > 1000;
      }
    });
  }, [clients, bucket, search]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sort.key) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "lifetimeRevenue":
          av = a.lifetimeRevenue;
          bv = b.lifetimeRevenue;
          break;
        case "outstandingAR":
          av = a.outstandingAR;
          bv = b.outstandingAR;
          break;
        case "invoiceCount":
          av = a.invoiceCount;
          bv = b.invoiceCount;
          break;
        case "daysSinceLastInvoice":
          av = a.daysSinceLastInvoice ?? Number.MAX_SAFE_INTEGER;
          bv = b.daysSinceLastInvoice ?? Number.MAX_SAFE_INTEGER;
          break;
        case "engagement":
          av = a.engagement;
          bv = b.engagement;
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

  const toggleSort = (key: SortKey) => {
    if (sort.key === key) setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    else setSort({ key, dir: "desc" });
  };

  // Engagement distribution chart
  const engagementDist = useMemo(() => {
    const bins: Record<string, { count: number; revenue: number }> = {};
    for (const c of clients) {
      const k = c.engagement;
      if (!bins[k]) bins[k] = { count: 0, revenue: 0 };
      bins[k].count += 1;
      bins[k].revenue += c.lifetimeRevenue;
    }
    return Object.entries(bins).map(([engagement, v]) => ({ engagement, ...v })).sort((a, b) => b.revenue - a.revenue);
  }, [clients]);
  const engagementMax = Math.max(1, ...engagementDist.map((b) => b.revenue));

  return (
    <>
      {/* Filter row */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none pl-8 w-full"
          />
        </div>
        <div className="text-[11px] font-mono text-ink-faint tabnum">
          Showing <span className="text-ink">{filtered.length.toLocaleString()}</span> of {clients.length.toLocaleString()} clients
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <StatCard label="Active clients" tone="emerald" value={kpis.activeCount.toString()} sub={`of ${clients.length} total`} active={bucket === "active"} onClick={() => setBucket("active")} />
        <StatCard label="At-risk active" tone="amber" value={kpis.atRiskCount.toString()} sub="Active · no invoice 90d+" active={bucket === "at-risk"} onClick={() => setBucket("at-risk")} />
        <StatCard label="Total revenue" tone="emerald" value={fmtCurrency(kpis.totalRevenue)} sub="Lifetime" />
        <StatCard label="Outstanding" tone="red" value={fmtCurrency(kpis.totalOutstanding)} sub="Across all clients" />
        <StatCard label="Whale exposure" tone="violet" value={`${kpis.whalePct.toFixed(0)}%`} sub={`Top 10 = ${fmtCurrency(kpis.top10Total)}`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Misclassified" tone="amber" value={kpis.misclassified.toString()} sub={`"New" w/ revenue > $1K`} active={bucket === "misclassified"} onClick={() => setBucket("misclassified")} />
        <StatCard label="Occasional" tone="sky" value={clients.filter((c) => c.engagement === "Occasional").length.toString()} sub="Occasional engagement" active={bucket === "occasional"} onClick={() => setBucket("occasional")} />
        <StatCard label="Iddle" tone="amber" value={clients.filter((c) => c.engagement === "Iddle").length.toString()} sub="Iddle engagement" active={bucket === "iddle"} onClick={() => setBucket("iddle")} />
        <StatCard label="Lost" tone="red" value={clients.filter((c) => c.engagement === "Lost").length.toString()} sub="Lost engagement" active={bucket === "lost"} onClick={() => setBucket("lost")} />
        <StatCard label="New" tone="violet" value={clients.filter((c) => c.engagement === "New").length.toString()} sub="Marked new" active={bucket === "new"} onClick={() => setBucket("new")} />
      </div>

      {/* Engagement distribution chart */}
      <div className="bg-surface rounded-card border border-rule p-5 mb-6">
        <div className="flex items-baseline justify-between mb-5">
          <h3 className="eyebrow">Engagement frequency — revenue distribution</h3>
          <div className="text-[12px] text-ink-muted tabnum font-mono">
            <span className="text-ink-strong">{clients.length}</span> companies
          </div>
        </div>
        <div className="space-y-2">
          {engagementDist.map((b) => {
            const widthPct = (b.revenue / engagementMax) * 100;
            const colorMap: Record<string, string> = {
              Active: "bg-emerald",
              Occasional: "bg-sky",
              Iddle: "bg-amber",
              Lost: "bg-red/70",
              New: "bg-violet",
              Archived: "bg-ink-faint",
            };
            return (
              <div key={b.engagement} className="grid grid-cols-[80px_1fr_90px_28px] sm:grid-cols-[110px_1fr_120px_40px] items-center gap-2 sm:gap-3">
                <span className="text-[11px] sm:text-[12px] text-ink">{b.engagement}</span>
                <div className="h-4 sm:h-5 bg-bg rounded-sm overflow-hidden">
                  <div className={`h-full ${colorMap[b.engagement] ?? "bg-ink-muted"}`} style={{ width: `${widthPct}%` }} />
                </div>
                <span className="text-[11px] sm:text-[12px] text-ink-strong font-semibold tabnum text-right">{fmtCurrency(b.revenue)}</span>
                <span className="text-[10px] sm:text-[11px] text-ink-faint tabnum font-mono text-right">{b.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clients table */}
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-elevated border-b border-rule">
              <tr>
                <th onClick={() => toggleSort("name")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-left">
                  Client {sort.key === "name" && <span className="text-emerald text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th onClick={() => toggleSort("engagement")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-left">
                  Engagement {sort.key === "engagement" && <span className="text-emerald text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Contract</th>
                <th onClick={() => toggleSort("invoiceCount")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Invoices {sort.key === "invoiceCount" && <span className="text-emerald text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th onClick={() => toggleSort("lifetimeRevenue")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Lifetime $ {sort.key === "lifetimeRevenue" && <span className="text-emerald text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th onClick={() => toggleSort("outstandingAR")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Outstanding {sort.key === "outstandingAR" && <span className="text-emerald text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th onClick={() => toggleSort("daysSinceLastInvoice")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Last seen {sort.key === "daysSinceLastInvoice" && <span className="text-emerald text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[13px] text-ink-muted">No clients match the current filters.</td></tr>
              ) : (
                sorted.map((c) => {
                  const atRisk = c.engagement === "Active" && c.daysSinceLastInvoice != null && c.daysSinceLastInvoice > 90;
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)} className={`border-b border-rule-soft last:border-0 cursor-pointer transition-colors ${selected?.id === c.id ? "bg-emerald-soft" : "hover:bg-bg-elevated"}`}>
                      <td className="px-3 py-2.5 text-[13px] text-ink-strong">{c.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${ENGAGEMENT_COLOR[c.engagement] ?? "bg-rule text-ink-muted"}`}>
                          {c.engagement}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-ink-muted">{c.contractType ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[12px] font-mono tabnum text-ink-muted">{c.invoiceCount}</td>
                      <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-strong tabnum">{fmtCurrency(c.lifetimeRevenue)}</td>
                      <td className={`px-3 py-2.5 text-right text-[12px] tabnum font-mono ${c.outstandingAR > 0 ? "text-red font-semibold" : "text-ink-faint"}`}>
                        {c.outstandingAR > 0 ? fmtCurrency(c.outstandingAR) : "—"}
                      </td>
                      <td className={`px-3 py-2.5 text-right text-[12px] font-mono tabnum ${atRisk ? "text-red font-semibold" : "text-ink-muted"}`}>
                        {c.daysSinceLastInvoice != null ? `${c.daysSinceLastInvoice}d` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClientSheet client={selected} onClose={() => setSelected(null)} />
    </>
  );
}
