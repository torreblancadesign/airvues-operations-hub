"use client";

import { Filter, EMPTY_FILTER } from "./types";

type Props = {
  filter: Filter;
  setFilter: (f: Filter) => void;
  payers: string[];
  totalCount: number;
  filteredCount: number;
};

const inputCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors";

const selectCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer";

export function FilterBar({ filter, setFilter, payers, totalCount, filteredCount }: Props) {
  const update = <K extends keyof Filter>(key: K, value: Filter[K]) =>
    setFilter({ ...filter, [key]: value });

  const hasActive =
    filter.search !== "" ||
    filter.status !== "all" ||
    filter.source !== "all" ||
    filter.type !== "all" ||
    filter.payer !== null ||
    filter.from !== null ||
    filter.to !== null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search — full-width on mobile, flexes on desktop */}
        <div className="w-full sm:flex-1 sm:min-w-[240px] relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={filter.search}
            onChange={(e) => update("search", e.target.value)}
            placeholder="Search invoices..."
            className={`${inputCls} pl-8 w-full`}
          />
        </div>

        <span className="text-[11px] text-ink-faint">From</span>
        <input
          type="date"
          value={filter.from || ""}
          onChange={(e) => update("from", e.target.value || null)}
          className={`${inputCls} font-mono`}
          aria-label="From date"
        />
        <span className="text-[11px] text-ink-faint">To</span>
        <input
          type="date"
          value={filter.to || ""}
          onChange={(e) => update("to", e.target.value || null)}
          className={`${inputCls} font-mono`}
          aria-label="To date"
        />

        <select
          value={filter.source}
          onChange={(e) => update("source", e.target.value as Filter["source"])}
          className={selectCls}
        >
          <option value="all">Source</option>
          <option value="Stripe">Stripe</option>
          <option value="Fiverr">Fiverr</option>
          <option value="Other">Other</option>
        </select>

        <select
          value={filter.type}
          onChange={(e) => update("type", e.target.value as Filter["type"])}
          className={selectCls}
        >
          <option value="all">Type</option>
          <option value="One-time">One-time</option>
          <option value="Recurring">Recurring</option>
          <option value="Payment Plan">Payment Plan</option>
        </select>

        <select
          value={filter.status}
          onChange={(e) => update("status", e.target.value as Filter["status"])}
          className={selectCls}
        >
          <option value="all">Status</option>
          <option value="paid">Paid</option>
          <option value="open">Open (unpaid)</option>
          <option value="overdue">Past due</option>
          <option value="subscribed">Subscribed</option>
          <option value="void">Void / Canceled</option>
        </select>

        <select
          value={filter.payer || ""}
          onChange={(e) => update("payer", e.target.value || null)}
          className={`${selectCls} max-w-[180px]`}
        >
          <option value="">All payers</option>
          {payers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

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
        Showing <span className="text-ink">{filteredCount.toLocaleString()}</span> of {totalCount.toLocaleString()} invoices
      </div>
    </div>
  );
}
