"use client";

import { Filter, EMPTY_FILTER } from "./types";

const inputCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors";
const selectCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer";

type Props = {
  filter: Filter;
  setFilter: (f: Filter) => void;
  totalCount: number;
  filteredCount: number;
};

export function LeadsFilterBar({ filter, setFilter, totalCount, filteredCount }: Props) {
  const update = <K extends keyof Filter>(key: K, value: Filter[K]) =>
    setFilter({ ...filter, [key]: value });

  const hasActive =
    filter.search !== "" ||
    filter.status !== "all" ||
    filter.source !== "all" ||
    filter.budget !== "all" ||
    filter.from !== null ||
    filter.to !== null ||
    filter.staleOnly;

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
            placeholder="Search name, company, email, title..."
            className={`${inputCls} pl-8 w-full`}
          />
        </div>

        <span className="text-[11px] text-ink-faint">From</span>
        <input type="date" value={filter.from || ""} onChange={(e) => update("from", e.target.value || null)} className={`${inputCls} font-mono`} />
        <span className="text-[11px] text-ink-faint">To</span>
        <input type="date" value={filter.to || ""} onChange={(e) => update("to", e.target.value || null)} className={`${inputCls} font-mono`} />

        <select value={filter.status} onChange={(e) => update("status", e.target.value as Filter["status"])} className={selectCls}>
          <option value="all">All statuses</option>
          <option value="New Lead">New Lead</option>
          <option value="Needs Review">Needs Review</option>
          <option value="In Proposal Stage">In Proposal Stage</option>
          <option value="Sold">Sold</option>
          <option value="Not Sold">Not Sold</option>
        </select>

        <select value={filter.source} onChange={(e) => update("source", e.target.value as Filter["source"])} className={selectCls}>
          <option value="all">All sources</option>
          <option value="From Fillout">From Fillout</option>
          <option value="Manually Scheduled">Manually Scheduled</option>
        </select>

        <select value={filter.budget} onChange={(e) => update("budget", e.target.value as Filter["budget"])} className={selectCls}>
          <option value="all">All budgets</option>
          <option value="<$500">&lt;$500</option>
          <option value="$1000 - $2000">$1000 - $2000</option>
          <option value="$5000+">$5000+</option>
        </select>

        <label className="flex items-center gap-1.5 text-[12px] text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={filter.staleOnly}
            onChange={(e) => update("staleOnly", e.target.checked)}
            className="accent-amber"
          />
          Stale only (&gt;3d untriaged)
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
        Showing <span className="text-ink">{filteredCount.toLocaleString()}</span> of {totalCount.toLocaleString()} leads
      </div>
    </div>
  );
}
