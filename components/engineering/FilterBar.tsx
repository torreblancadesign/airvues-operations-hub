"use client";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EMPTY_FILTER, Filter, PRIORITIES, StatusBucket } from "./types";

type EngineerOption = { id: string; name: string };

type Props = {
  filter: Filter;
  setFilter: (f: Filter) => void;
  engineers: EngineerOption[];
  clients: string[];
  totalStories: number;
  filteredCount: number;
};

const inputCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors";
const selectCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer";

export function EngineeringFilterBar({
  filter,
  setFilter,
  engineers,
  clients,
  totalStories,
  filteredCount,
}: Props) {
  const update = <K extends keyof Filter>(key: K, value: Filter[K]) =>
    setFilter({ ...filter, [key]: value });

  const hasActive =
    filter.search !== "" ||
    filter.status !== "active" ||
    filter.engineerId !== null ||
    filter.client !== null ||
    filter.sprintNumber !== null ||
    filter.priority !== null ||
    filter.orphanOnly;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
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
            placeholder="Search story name..."
            className={`${inputCls} pl-8 w-full`}
          />
        </div>

        <select
          value={filter.status}
          onChange={(e) => update("status", e.target.value as StatusBucket)}
          className={selectCls}
          aria-label="Status filter"
        >
          <option value="active">Active</option>
          <option value="all">All statuses</option>
          <option value="todo">Todo</option>
          <option value="in-progress">In progress</option>
          <option value="qa">QA Review</option>
          <option value="done">Completed</option>
          <option value="hold">On Hold / Incomplete</option>
        </select>

        <SearchableSelect
          value={filter.engineerId}
          onChange={(v) => update("engineerId", v)}
          options={engineers.map((e) => ({ value: e.id, label: e.name }))}
          allLabel="All engineers"
        />

        <SearchableSelect
          value={filter.client}
          onChange={(v) => update("client", v)}
          options={clients.map((c) => ({ value: c, label: c }))}
          allLabel="All clients"
        />

        <select
          value={filter.priority ?? ""}
          onChange={(e) => update("priority", e.target.value || null)}
          className={selectCls}
          aria-label="Priority filter"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
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
        Showing <span className="text-ink">{filteredCount.toLocaleString()}</span> of{" "}
        {totalStories.toLocaleString()} stories
      </div>
    </div>
  );
}
