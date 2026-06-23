"use client";

import { Filter, EMPTY_FILTER } from "./types";

const inputCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors";
const selectCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer";

type Props = {
  filter: Filter;
  setFilter: (f: Filter) => void;
  clients: string[];
  preparers: string[];
  totalCount: number;
  filteredCount: number;
};

export function PipelineFilterBar({ filter, setFilter, clients, preparers, totalCount, filteredCount }: Props) {
  const update = <K extends keyof Filter>(key: K, value: Filter[K]) =>
    setFilter({ ...filter, [key]: value });

  const hasActive =
    filter.search !== "" ||
    filter.stage !== "all" ||
    filter.proposalType !== "all" ||
    filter.client !== null ||
    filter.preparedBy !== null ||
    filter.from !== null ||
    filter.to !== null ||
    filter.stalledOnly ||
    filter.deadlineRisk !== "all" ||
    filter.showRejected;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-full sm:flex-1 sm:min-w-[240px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={filter.search}
            onChange={(e) => update("search", e.target.value)}
            placeholder="Search project, client, prep by..."
            className={`${inputCls} pl-8 w-full`}
          />
        </div>

        <span className="text-[11px] text-ink-faint">From</span>
        <input type="date" value={filter.from || ""} onChange={(e) => update("from", e.target.value || null)} className={`${inputCls} font-mono`} />
        <span className="text-[11px] text-ink-faint">To</span>
        <input type="date" value={filter.to || ""} onChange={(e) => update("to", e.target.value || null)} className={`${inputCls} font-mono`} />

        <select
          value={filter.stage}
          onChange={(e) => update("stage", e.target.value as Filter["stage"])}
          className={selectCls}
          title="Filter by Deal Stage (internal sales pipeline)"
        >
          <option value="all">All deal stages</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent · awaiting</option>
          <option value="signed">Signed</option>
          <option value="paid">Paid</option>
          <option value="lost">Cancelled / Rejected</option>
          <option value="auditing">Auditing</option>
        </select>

        <select value={filter.proposalType} onChange={(e) => update("proposalType", e.target.value as Filter["proposalType"])} className={selectCls}>
          <option value="all">All types</option>
          <option value="Airtable Solutions Proposal">Airtable Solutions Proposal</option>
          <option value="Retainer Agreement">Retainer Agreement</option>
        </select>

        <select value={filter.client || ""} onChange={(e) => update("client", e.target.value || null)} className={`${selectCls} max-w-[160px]`}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filter.preparedBy || ""} onChange={(e) => update("preparedBy", e.target.value || null)} className={`${selectCls} max-w-[160px]`}>
          <option value="">All preparers</option>
          {preparers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filter.deadlineRisk}
          onChange={(e) => update("deadlineRisk", e.target.value as Filter["deadlineRisk"])}
          className={selectCls}
          title="Filter by Client Delivery Due Date risk"
        >
          <option value="all">All deadlines</option>
          <option value="needs-attention">Needs attention</option>
          <option value="overdue">Overdue</option>
          <option value="red">≤3 days</option>
          <option value="yellow">≤7 days</option>
        </select>

        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={filter.stalledOnly}
            onChange={(e) => update("stalledOnly", e.target.checked)}
            className="accent-amber"
          />
          Stalled only
        </label>

        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={filter.showRejected}
            onChange={(e) => update("showRejected", e.target.checked)}
            className="accent-red"
          />
          Show rejected
        </label>

        {hasActive && (
          <button
            type="button"
            onClick={() => setFilter(EMPTY_FILTER)}
            className="px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-2 text-[11px] font-mono text-ink-faint tabnum">
        Showing <span className="text-ink">{filteredCount.toLocaleString()}</span> of {totalCount.toLocaleString()} quotes
      </div>
    </div>
  );
}
