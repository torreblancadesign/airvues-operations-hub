"use client";

import { useMemo, useState } from "react";
import { Lead, LeadStatus } from "@/lib/leads";
import { StatCard } from "@/components/ui/StatCard";
import { LeadsFilterBar } from "./FilterBar";
import { LeadsTable } from "./LeadsTable";
import { LeadSheet } from "./LeadSheet";
import { UpcomingMeetings } from "./UpcomingMeetings";
import { StatusFunnel } from "./StatusFunnel";
import { SourceBudgetBreakdown } from "./SourceBudgetBreakdown";
import { DEFAULT_SORT, EMPTY_FILTER, Filter, Sort, Window } from "./types";

type Props = {
  leads: Lead[];
  initialFilter?: Partial<Filter>;
  canEdit?: boolean;
};

function windowStart(win: Window): number {
  const now = new Date();
  if (win === "ytd") return new Date(now.getFullYear(), 0, 1).getTime();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function WindowToggle({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  const btn = (w: Window, label: string) => {
    const active = value === w;
    return (
      <button
        key={w}
        type="button"
        onClick={() => onChange(w)}
        className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors rounded-sm ${
          active ? "bg-emerald/15 text-emerald" : "text-ink-faint hover:text-ink-muted"
        }`}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="inline-flex items-center gap-0.5 bg-bg border border-rule rounded-md p-0.5">
      {btn("ytd", "YTD")}
      {btn("mtd", "MTD")}
    </div>
  );
}

function applyFilter(rows: Lead[], f: Filter): Lead[] {
  const now = Date.now();
  return rows.filter((l) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${l.name} ${l.company ?? ""} ${l.email ?? ""} ${l.title ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status !== "all" && l.status !== f.status) return false;
    if (f.source !== "all" && l.source !== f.source) return false;
    if (f.budget !== "all" && l.budget !== f.budget) return false;
    if (f.from && l.createdTime.slice(0, 10) < f.from) return false;
    if (f.to && l.createdTime.slice(0, 10) > f.to) return false;
    if (f.staleOnly) {
      const ageDays = (now - new Date(l.createdTime).getTime()) / 86_400_000;
      const isUntriaged = l.status === "New Lead" || l.status === "Needs Review" || l.status === null;
      if (!(isUntriaged && ageDays > 3)) return false;
    }
    return true;
  });
}

function applySort(rows: Lead[], s: Sort): Lead[] {
  const dir = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    switch (s.key) {
      case "createdTime": av = a.createdTime; bv = b.createdTime; break;
      case "name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
      case "company": av = (a.company ?? "").toLowerCase(); bv = (b.company ?? "").toLowerCase(); break;
      case "meetingDate": av = a.meetingDate ?? ""; bv = b.meetingDate ?? ""; break;
      case "status": av = a.status ?? ""; bv = b.status ?? ""; break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

export function LeadsDashboard({ leads, initialFilter, canEdit = false }: Props) {
  const [filter, setFilter] = useState<Filter>({ ...EMPTY_FILTER, ...initialFilter });
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [win, setWin] = useState<Window>("ytd");

  const kpis = useMemo(() => {
    const cutoff = windowStart(win);
    let newLeads = 0, sold = 0, notSold = 0, inProposal = 0;
    let meetingDays = 0, meetingDaysCount = 0;
    let earliestInWindow = Infinity;
    for (const l of leads) {
      const created = new Date(l.createdTime).getTime();
      const inWindow = created >= cutoff;
      if (inWindow) {
        newLeads += 1;
        if (created < earliestInWindow) earliestInWindow = created;
        if (l.status === "Sold") sold += 1;
        if (l.status === "Not Sold") notSold += 1;
        if (l.meetingDate) {
          const diff = (new Date(l.meetingDate).getTime() - created) / 86_400_000;
          if (diff >= 0) { meetingDays += diff; meetingDaysCount += 1; }
        }
      }
      // In Proposal is a current pipeline state — lifetime, not windowed.
      if (l.status === "In Proposal Stage") inProposal += 1;
    }
    const winRate = newLeads > 0 ? (sold / newLeads) * 100 : null;
    const avgTtm = meetingDaysCount > 0 ? meetingDays / meetingDaysCount : null;
    // Avg time-between-leads: (now − earliest lead in window) / count.
    // Using "now" as the right edge means a quiet recent stretch correctly
    // raises the average, so the number reflects current cadence.
    const avgGap = newLeads >= 2
      ? ((Date.now() - earliestInWindow) / 86_400_000) / newLeads
      : null;
    return { newLeads, sold, notSold, inProposal, winRate, avgTtm, avgGap };
  }, [leads, win]);

  const staleCount = useMemo(() => {
    const now = Date.now();
    return leads.filter((l) => {
      const ageDays = (now - new Date(l.createdTime).getTime()) / 86_400_000;
      const isUntriaged = l.status === "New Lead" || l.status === "Needs Review" || l.status === null;
      return isUntriaged && ageDays > 3;
    }).length;
  }, [leads]);

  const filtered = useMemo(() => applyFilter(leads, filter), [leads, filter]);
  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort]);

  const setStatus = (s: LeadStatus) => setFilter({ ...EMPTY_FILTER, status: s });
  const windowLabel = win === "ytd" ? "YTD" : "MTD";

  return (
    <>
      {/* KPI strip with window toggle */}
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow">Pulse · {windowLabel}</div>
        <WindowToggle value={win} onChange={setWin} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mb-3">
        <StatCard label={`New Leads (${windowLabel})`} tone="sky" value={kpis.newLeads.toString()} sub="created in window" />
        <StatCard
          label={`Avg time between leads (${windowLabel})`}
          tone="sky"
          value={kpis.avgGap != null ? `${kpis.avgGap.toFixed(1)}d` : "—"}
          sub="cadence of new leads"
        />
        <StatCard
          label="In Proposal"
          tone="amber"
          value={kpis.inProposal.toString()}
          sub="lifetime · click to filter"
          active={filter.status === "In Proposal Stage"}
          onClick={() => setStatus("In Proposal Stage")}
        />
        <StatCard
          label={`Sold (${windowLabel})`}
          tone="emerald"
          value={kpis.sold.toString()}
          sub="click to filter"
          active={filter.status === "Sold"}
          onClick={() => setStatus("Sold")}
        />
        <StatCard
          label={`Not Sold (${windowLabel})`}
          tone="red"
          value={kpis.notSold.toString()}
          sub="click to filter"
          active={filter.status === "Not Sold"}
          onClick={() => setStatus("Not Sold")}
        />
        <StatCard
          label={`Win rate (${windowLabel})`}
          tone="emerald"
          value={kpis.winRate != null ? `${kpis.winRate.toFixed(0)}%` : "—"}
          sub={`${kpis.sold} sold / ${kpis.newLeads} leads`}
        />
        <StatCard
          label="Avg time-to-meeting"
          tone="neutral"
          value={kpis.avgTtm != null ? `${kpis.avgTtm.toFixed(1)}d` : "—"}
          sub="created → meeting"
        />
      </div>

      {/* Stale lead banner */}
      {staleCount > 0 && (
        <button
          type="button"
          onClick={() => setFilter({ ...EMPTY_FILTER, staleOnly: true })}
          className="w-full mb-4 px-4 py-2.5 bg-red-soft border border-red/30 rounded-md text-left text-[12px] text-red hover:bg-red-soft/80 transition-colors flex items-center justify-between"
        >
          <span>
            ⚠ <span className="font-semibold">{staleCount} lead{staleCount === 1 ? "" : "s"}</span> sitting in New / Needs Review for over 3 days.
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider">Triage now →</span>
        </button>
      )}

      <UpcomingMeetings leads={leads} onSelect={setSelected} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <StatusFunnel leads={leads} onSelectStatus={setStatus} />
        <SourceBudgetBreakdown leads={leads} />
      </div>

      <LeadsFilterBar
        filter={filter}
        setFilter={setFilter}
        totalCount={leads.length}
        filteredCount={filtered.length}
      />

      <LeadsTable rows={sorted} sort={sort} setSort={setSort} onRowClick={setSelected} selectedId={selected?.id ?? null} />

      <LeadSheet lead={selected} onClose={() => setSelected(null)} canEdit={canEdit} />
    </>
  );
}
