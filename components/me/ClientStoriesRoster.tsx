"use client";

import { useMemo, useState } from "react";
import { Story } from "@/lib/engineering-types";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { StoryTable } from "@/components/engineering/StoryTable";
import { PRIORITIES, STATUS_GROUPS, StatusBucket } from "@/components/engineering/types";

type Props = {
  stories: Story[];
  selectedId: string | null;
  onSelect: (s: Story) => void;
};

const NO_CLIENT = "No client";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const inputCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors";
const selectCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer";

type ClientGroup = {
  name: string;
  stories: Story[];
  doing: number;
  todo: number;
  qa: number;
  commission: number;
};

// One collapsible card per client — same shape as the engineering roster row,
// with a card-local status filter and the shared story table inside.
function ClientRow({
  group,
  maxCommission,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  group: ClientGroup;
  maxCommission: number;
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (s: Story) => void;
}) {
  const [cardStatus, setCardStatus] = useState<string | null>(null);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of group.stories) if (s.status) set.add(s.status);
    return [...set].sort();
  }, [group.stories]);

  const visibleStories = useMemo(
    () => group.stories.filter((s) => !cardStatus || s.status === cardStatus),
    [group.stories, cardStatus],
  );

  const isNoClient = group.name === NO_CLIENT;
  const barPct =
    maxCommission > 0 ? Math.min(100, (group.commission / maxCommission) * 100) : 0;

  return (
    <section
      className={`bg-surface border border-rule rounded-card overflow-hidden ${
        isNoClient ? "border-amber/30" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${isNoClient ? "bg-amber" : "bg-emerald"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold text-ink-strong leading-tight truncate">
                {group.name}
              </span>
              <span className="hidden sm:flex items-center gap-3 shrink-0 text-[11px] font-mono text-ink-muted tabnum">
                {group.doing > 0 && (
                  <span className="text-emerald">{group.doing} doing</span>
                )}
                {group.todo > 0 && <span>{group.todo} todo</span>}
                {group.qa > 0 && <span className="text-sky">{group.qa} QA</span>}
                <span className="text-emerald font-semibold">
                  {fmtMoney(group.commission)}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-1 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isNoClient ? "bg-amber" : "bg-emerald"}`}
                style={{ width: `${Math.max(barPct, 2)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-ink-muted truncate">
              {group.stories.length} stor{group.stories.length === 1 ? "y" : "ies"} · commission
              at your rate
            </div>
          </div>
        </div>
        <span className="text-ink-faint text-[14px] font-mono w-3 shrink-0">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-rule">
          <div className="px-4 py-2 bg-bg-elevated border-b border-rule flex items-center gap-2 flex-wrap text-[11px]">
            <select
              value={cardStatus ?? ""}
              onChange={(e) => setCardStatus(e.target.value || null)}
              className={selectCls}
              aria-label={`Status filter for ${group.name}`}
            >
              <option value="">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {cardStatus && (
              <span className="font-mono text-ink-faint tabnum">
                {visibleStories.length} of {group.stories.length}
              </span>
            )}
          </div>
          <StoryTable
            stories={visibleStories}
            selectedId={selectedId}
            onSelect={onSelect}
            hideClient
          />
        </div>
      )}
    </section>
  );
}

export function ClientStoriesRoster({ stories, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusBucket>("active");
  const [client, setClient] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  // Everything starts collapsed — the client list reads as an overview first.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of stories) {
      if (s.clientNames.length === 0) set.add(NO_CLIENT);
      for (const c of s.clientNames) set.add(c);
    }
    return [...set].sort().map((c) => ({ value: c, label: c }));
  }, [stories]);

  const filtered = useMemo(
    () =>
      stories.filter((s) => {
        if (search) {
          const q = search.toLowerCase();
          const hay = `${s.name} ${s.clientNames.join(" ")} ${s.storyNumber ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (status !== "all") {
          const allowed = STATUS_GROUPS[status];
          if (allowed !== "*") {
            if (!s.status || !allowed.includes(s.status)) return false;
          }
        }
        if (client) {
          if (client === NO_CLIENT) {
            if (s.clientNames.length > 0) return false;
          } else if (!s.clientNames.includes(client)) {
            return false;
          }
        }
        if (priority && s.priority !== priority) return false;
        return true;
      }),
    [stories, search, status, client, priority],
  );

  const roster = useMemo(() => {
    const map = new Map<string, Story[]>();
    for (const s of filtered) {
      const key = s.clientNames[0] ?? NO_CLIENT;
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    const groups: ClientGroup[] = [...map.entries()].map(([name, list]) => ({
      name,
      stories: list,
      doing: list.filter((s) => s.status === "In progress").length,
      todo: list.filter((s) => s.status === "Todo").length,
      qa: list.filter((s) => s.status === "QA Review").length,
      commission: list.reduce((sum, s) => sum + s.commission, 0),
    }));
    groups.sort(
      (a, b) => b.commission - a.commission || a.name.localeCompare(b.name),
    );
    const maxCommission = Math.max(...groups.map((g) => g.commission), 1);
    return { groups, maxCommission };
  }, [filtered]);

  const hasActive =
    search !== "" || status !== "active" || client !== null || priority !== null;

  return (
    <div>
      <div className="mb-4">
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search story name..."
              className={`${inputCls} pl-8 w-full`}
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusBucket)}
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
            value={client}
            onChange={setClient}
            options={clientOptions}
            allLabel="All clients"
          />

          <select
            value={priority ?? ""}
            onChange={(e) => setPriority(e.target.value || null)}
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
              onClick={() => {
                setSearch("");
                setStatus("active");
                setClient(null);
                setPriority(null);
              }}
              className="px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-2 text-[11px] font-mono text-ink-faint tabnum">
          Showing <span className="text-ink">{filtered.length.toLocaleString()}</span> of{" "}
          {stories.length.toLocaleString()} stories
        </div>
      </div>

      <div className="space-y-3">
        {roster.groups.map((g) => (
          <ClientRow
            key={g.name}
            group={g}
            maxCommission={roster.maxCommission}
            expanded={expanded.has(g.name)}
            onToggle={() => toggleExpand(g.name)}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}

        {roster.groups.length === 0 && (
          <div className="text-center py-12 text-ink-muted text-[13px]">
            No stories match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
