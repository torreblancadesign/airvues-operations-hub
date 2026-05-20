"use client";

import { useMemo, useState } from "react";
import { Story } from "@/lib/engineering-types";
import { StatCard } from "@/components/ui/StatCard";
import { StorySheet } from "@/components/engineering/StorySheet";
import { BacklogRow } from "./BacklogRow";
import { BulkBar } from "./BulkBar";
import { NewStoryModal } from "./NewStoryModal";
import { BacklogFilter, EMPTY_BACKLOG_FILTER, SCOPE_TO_STATUSES } from "./types";

type EngineerOption = { id: string; name: string };
type QuoteOption = { id: string; label: string; totalCost: number; status: string | null };

type Props = {
  stories: Story[];
  engineers: EngineerOption[];
  assignableEngineers: EngineerOption[];
  clients: string[];
  quotes: QuoteOption[];
  canEdit: boolean;
  initialFilter?: Partial<BacklogFilter>;
};


const inputCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors";
const selectCls =
  "px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer";

function matches(s: Story, f: BacklogFilter): boolean {
  if (s.status === "Archived") return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${s.name} ${s.clientNames.join(" ")} ${s.assigneeNames.join(" ")} ${s.storyNumber ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.scope === "orphan") {
    if (s.assigneeIds.length > 0) return false;
    if (s.status === "Completed" || s.status === "Archived") return false;
  } else {
    const allowed = SCOPE_TO_STATUSES[f.scope];
    if (allowed !== "*" && (!s.status || !allowed.includes(s.status))) return false;
  }
  if (f.engineerId === "__orphan__") {
    if (s.assigneeIds.length > 0) return false;
  } else if (f.engineerId) {
    if (!s.assigneeIds.includes(f.engineerId)) return false;
  }
  if (f.client && !s.clientNames.includes(f.client)) return false;
  if (f.priority && s.priority !== f.priority) return false;
  return true;
}

export function BacklogList({ stories, engineers, assignableEngineers, clients, quotes, canEdit, initialFilter }: Props) {
  const [filter, setFilter] = useState<BacklogFilter>({ ...EMPTY_BACKLOG_FILTER, ...initialFilter });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openStory, setOpenStory] = useState<Story | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const filtered = useMemo(() => stories.filter((s) => matches(s, filter)), [stories, filter]);

  const totals = useMemo(() => {
    let hours = 0;
    let orphan = 0;
    for (const s of filtered) {
      hours += s.hours ?? 0;
      if (s.assigneeIds.length === 0) orphan++;
    }
    return { hours, orphan };
  }, [filtered]);

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleSelect(id: string, _shiftKey: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function refreshAfterMutation() {
    // The Server Action already revalidated cache tags; this clears the
    // selection so the user sees a clean post-edit state. The page itself
    // will refetch on next nav. For instant refresh, the user can reload.
    setSelected(new Set());
  }

  return (
    <>
      {/* Action bar */}
      {canEdit && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors inline-flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Story
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="In view"
          value={filtered.length.toLocaleString()}
          sub={`of ${stories.length.toLocaleString()} total`}
        />
        <StatCard
          label="Orphan stories"
          tone={totals.orphan > 0 ? "red" : "neutral"}
          value={totals.orphan.toLocaleString()}
          sub="No engineer assigned"
        />
        <StatCard
          label="Scoped hours"
          value={`${totals.hours.toFixed(0)}h`}
          sub="Estimated work in view"
        />
        <StatCard
          label="Avg hrs / story"
          value={filtered.length ? `${(totals.hours / filtered.length).toFixed(1)}h` : "—"}
          sub="Across stories in view"
        />
      </div>

      {/* Filter bar */}
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:flex-1 sm:min-w-[240px] relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              placeholder="Search story name, client, assignee..."
              className={`${inputCls} pl-8 w-full`}
            />
          </div>

          <select
            value={filter.scope}
            onChange={(e) => setFilter({ ...filter, scope: e.target.value as BacklogFilter["scope"] })}
            className={selectCls}
          >
            <option value="orphan">Needs triage (orphans)</option>
            <option value="active">All active</option>
            <option value="todo">Todo only</option>
            <option value="in-progress">In progress</option>
            <option value="qa">QA Review</option>
            <option value="done">Completed</option>
            <option value="all">Everything (incl. on hold)</option>
          </select>

          <select
            value={filter.engineerId ?? ""}
            onChange={(e) => setFilter({ ...filter, engineerId: e.target.value || null })}
            className={`${selectCls} max-w-[180px]`}
          >
            <option value="">All engineers</option>
            <option value="__orphan__">Unassigned only</option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <select
            value={filter.client ?? ""}
            onChange={(e) => setFilter({ ...filter, client: e.target.value || null })}
            className={`${selectCls} max-w-[180px]`}
          >
            <option value="">All clients</option>
            {clients.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filter.priority ?? ""}
            onChange={(e) => setFilter({ ...filter, priority: e.target.value || null })}
            className={selectCls}
          >
            <option value="">All priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {(filter.search || filter.scope !== "orphan" || filter.engineerId || filter.client || filter.priority) && (
            <button
              type="button"
              onClick={() => setFilter(EMPTY_BACKLOG_FILTER)}
              className="px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {canEdit && selected.size > 0 && (
        <BulkBar
          selectedIds={[...selected]}
          engineers={assignableEngineers}
          onClear={clearSelection}
          onSuccess={refreshAfterMutation}
        />
      )}

      {/* Table */}
      <div className="bg-surface border border-rule rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-bg-elevated border-b border-rule">
              <tr>
                <th className="px-3 py-2 w-8">
                  {canEdit && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={selectAllFiltered}
                      className="accent-emerald w-3.5 h-3.5"
                      aria-label="Select all visible"
                    />
                  )}
                </th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint">ID</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint">Story</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint hidden md:table-cell">Status</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint hidden lg:table-cell">Assignee</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint hidden md:table-cell">Client</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint hidden sm:table-cell text-right">Hrs</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint text-right">$</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint hidden lg:table-cell text-right">Comm</th>
                <th className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint hidden lg:table-cell">Sprint</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-[12px] text-ink-muted">
                    No stories match the current filter.
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <BacklogRow
                  key={s.id}
                  story={s}
                  selected={selected.has(s.id)}
                  active={openStory?.id === s.id}
                  onSelect={toggleSelect}
                  onOpen={setOpenStory}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <StorySheet
        story={openStory}
        engineers={assignableEngineers}
        canEdit={canEdit}
        onClose={() => setOpenStory(null)}
        onFilterByEngineer={(id) => {
          setFilter({ ...EMPTY_BACKLOG_FILTER, scope: "all", engineerId: id });
          setOpenStory(null);
        }}
        onFilterByClient={(c) => {
          setFilter({ ...EMPTY_BACKLOG_FILTER, scope: "all", client: c });
          setOpenStory(null);
        }}
      />

      <NewStoryModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        engineers={assignableEngineers}
        quotes={quotes}
      />
    </>
  );
}
