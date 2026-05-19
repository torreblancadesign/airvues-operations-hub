"use client";

import { useMemo, useState } from "react";
import { Subscription } from "@/lib/stack";
import { StatCard } from "@/components/ui/StatCard";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type SortKey = "name" | "amount" | "monthly" | "startDate";

export function StackDashboard({ subs }: { subs: Subscription[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("monthly");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [cadenceFilter, setCadenceFilter] = useState<"all" | "Monthly" | "Yearly">("all");

  const kpis = useMemo(() => {
    let monthlyBurn = 0;
    let yearlyTotal = 0;
    let monthlyCount = 0;
    let yearlyCount = 0;
    for (const s of subs) {
      monthlyBurn += s.monthlyEquivalent;
      if (s.cadence === "Monthly") monthlyCount += 1;
      if (s.cadence === "Yearly") { yearlyCount += 1; yearlyTotal += s.amount; }
    }
    const annualBurn = monthlyBurn * 12;
    const largest = subs.length > 0 ? subs.reduce((a, b) => (b.monthlyEquivalent > a.monthlyEquivalent ? b : a)) : null;
    return { monthlyBurn, annualBurn, monthlyCount, yearlyCount, largest, total: subs.length };
  }, [subs]);

  const filtered = useMemo(() => {
    return subs.filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (cadenceFilter !== "all" && s.cadence !== cadenceFilter) return false;
      return true;
    });
  }, [subs, search, cadenceFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sortKey) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "amount":
          av = a.amount;
          bv = b.amount;
          break;
        case "monthly":
          av = a.monthlyEquivalent;
          bv = b.monthlyEquivalent;
          break;
        case "startDate":
          av = a.startDate ?? "";
          bv = b.startDate ?? "";
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggle = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Monthly burn" tone="red" value={fmtCurrency(kpis.monthlyBurn)} sub="All subs normalized to /mo" />
        <StatCard label="Annual burn" tone="amber" value={fmtCurrency(kpis.annualBurn)} sub="Monthly × 12" />
        <StatCard label="Monthly subs" tone="neutral" value={kpis.monthlyCount.toString()} sub={`${kpis.yearlyCount} yearly`} />
        <StatCard label="Total subs" tone="neutral" value={kpis.total.toString()} sub="Internal SaaS" />
        <StatCard label="Largest sub" tone="sky" value={kpis.largest ? fmtCurrency(kpis.largest.monthlyEquivalent) : "—"} sub={kpis.largest?.name ?? "—"} />
      </div>

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
            placeholder="Search subscriptions..."
            className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none pl-8 w-full"
          />
        </div>
        <select
          value={cadenceFilter}
          onChange={(e) => setCadenceFilter(e.target.value as typeof cadenceFilter)}
          className="px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none cursor-pointer"
        >
          <option value="all">All cadences</option>
          <option value="Monthly">Monthly</option>
          <option value="Yearly">Yearly</option>
        </select>
        <div className="text-[11px] font-mono text-ink-faint tabnum">
          Showing <span className="text-ink">{filtered.length}</span> of {subs.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-elevated border-b border-rule">
              <tr>
                <th onClick={() => toggle("name")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-left">
                  Name {sortKey === "name" && <span className="text-emerald text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Cadence</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted text-left">Source</th>
                <th onClick={() => toggle("startDate")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-left">
                  Started {sortKey === "startDate" && <span className="text-emerald text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th onClick={() => toggle("amount")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  Amount {sortKey === "amount" && <span className="text-emerald text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </th>
                <th onClick={() => toggle("monthly")} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink-strong cursor-pointer text-right">
                  $/mo equiv {sortKey === "monthly" && <span className="text-emerald text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px] text-ink-muted">No subscriptions match.</td></tr>
              ) : (
                sorted.map((s) => (
                  <tr key={s.id} className="border-b border-rule-soft last:border-0 hover:bg-bg-elevated">
                    <td className="px-3 py-2.5 text-[13px] text-ink-strong">
                      <a href={s.airtableUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald transition-colors">{s.name}</a>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${s.cadence === "Monthly" ? "bg-sky-soft text-sky" : s.cadence === "Yearly" ? "bg-violet-soft text-violet" : "bg-rule text-ink-muted"}`}>
                        {s.cadence ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-ink-muted">{s.source ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono tabnum text-ink-muted">
                      {s.startDate ? new Date(s.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-ink-strong font-semibold tabnum">{fmtCurrency(s.amount)}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] text-ink-muted tabnum font-mono">{fmtCurrency(s.monthlyEquivalent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
