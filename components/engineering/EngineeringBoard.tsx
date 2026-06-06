"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EngineeringBoardData, Story } from "@/lib/engineering-types";
import { StatCard } from "@/components/ui/StatCard";
import { StoryCard } from "./StoryCard";
import { StorySheet } from "./StorySheet";
import { EngineeringFilterBar } from "./FilterBar";
import { CapacityPanel } from "./CapacityPanel";
import { EMPTY_FILTER, Filter, STATUS_GROUPS } from "./types";

type Props = {
  data: EngineeringBoardData;
  canEdit?: boolean;
};


function storyMatches(s: Story, f: Filter): boolean {
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${s.name} ${s.clientNames.join(" ")} ${s.storyNumber ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.status !== "all") {
    const allowed = STATUS_GROUPS[f.status];
    if (allowed !== "*") {
      if (!s.status || !allowed.includes(s.status)) return false;
    }
  }
  if (f.client && !s.clientNames.includes(f.client)) return false;
  if (f.sprintNumber != null && !s.sprintNumbers.includes(f.sprintNumber)) return false;
  return true;
}

export function EngineeringBoard({ data, canEdit = false }: Props) {
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<Story | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const engineersWithWork = useMemo(
    () =>
      data.groups
        .filter((g) => !g.isOrphan)
        .map((g) => ({ id: g.id, name: g.name })),
    [data.groups],
  );

  // Assignable list = only active internal people. Inactive people (e.g.
  // departed teammates) currently assigned to a story remain removable via
  // their chip's × button, but cannot be added to new stories.
  const assignableEngineers = useMemo(
    () =>
      data.assignablePeople
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.assignablePeople],
  );


  const filtered = useMemo(() => {
    let groups = data.groups;
    if (filter.orphanOnly) groups = groups.filter((g) => g.isOrphan);
    if (filter.engineerId) groups = groups.filter((g) => g.id === filter.engineerId);
    return groups.map((g) => ({
      ...g,
      visibleStories: g.stories.filter((s) => storyMatches(s, filter)),
    }));
  }, [data.groups, filter]);

  const filteredCount = filtered.reduce((sum, g) => sum + g.visibleStories.length, 0);

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Active stories"
          value={data.totals.activeStories.toLocaleString()}
          sub={`${data.totals.totalStories.toLocaleString()} total · ${data.totals.completedStories} done`}
        />
        <StatCard
          label="Open hours"
          tone="emerald"
          value={`${data.groups.reduce((sum, g) => sum + g.totals.activeHoursAssigned, 0)}h`}
          sub="Scoped on active stories"
        />
        <StatCard
          label="Unassigned"
          tone={data.totals.orphanStories > 0 ? "red" : "neutral"}
          value={data.totals.orphanStories.toLocaleString()}
          sub="Stories with no engineer"
          active={filter.orphanOnly}
          onClick={() => setFilter({ ...filter, orphanOnly: !filter.orphanOnly })}
        />
        <StatCard
          label="Over budget"
          tone={data.totals.overBudgetCount > 0 ? "amber" : "neutral"}
          value={data.totals.overBudgetCount.toLocaleString()}
          sub="Hours worked exceeds scoped"
        />
      </div>

      {/* Capacity planning — hours per engineer */}
      <CapacityPanel groups={data.groups} />

      {/* Orphan banner */}
      {data.totals.orphanStories > 0 && !filter.orphanOnly && (
        <div className="w-full mb-4 bg-red/10 border border-red/30 rounded-md px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-1 self-stretch bg-red rounded-full" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-red">
                {data.totals.orphanStories} stories have no engineer assigned
              </div>
              <div className="text-[12px] text-ink-muted mt-0.5">
                Engineer attribution and commission tracking will under-report until these are routed.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setFilter({ ...EMPTY_FILTER, orphanOnly: true })}
                className="px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors whitespace-nowrap"
              >
                Filter here
              </button>
              <Link
                href="/hygiene/orphans"
                className="px-2.5 py-1 text-[11px] bg-red text-bg font-semibold rounded hover:bg-red/80 transition-colors whitespace-nowrap"
              >
                Triage now →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottleneck signal — QA queue + analysis stalls */}
      {(data.totals.qaReviewCount > 0 || data.totals.analysisRequiredCount > 0) && (
        <div className="w-full mb-4 bg-amber/10 border border-amber/30 rounded-md px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="text-[12px] text-ink-muted">
            <span className="font-mono uppercase tracking-wider text-[10px] text-amber mr-2">Bottlenecks</span>
            <span className="text-ink-strong tabnum">{data.totals.qaReviewCount}</span> in QA Review ·{" "}
            <span className="text-ink-strong tabnum">{data.totals.analysisRequiredCount}</span> awaiting analysis
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data.totals.qaReviewCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter({ ...EMPTY_FILTER, status: "qa" })}
                className="px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors whitespace-nowrap"
              >
                QA queue →
              </button>
            )}
          </div>
        </div>
      )}

      <EngineeringFilterBar
        filter={filter}
        setFilter={setFilter}
        engineers={engineersWithWork}
        clients={data.clients}
        sprints={data.sprints}
        totalStories={data.totals.totalStories}
        filteredCount={filteredCount}
      />

      {/* Engineer sections */}
      <div className="space-y-6">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-muted text-[13px]">
            No engineers match the current filter.
          </div>
        )}
        {filtered.map((g) => {
          if (g.visibleStories.length === 0) return null;
          const isCollapsed = collapsed.has(g.id);
          return (
            <section key={g.id} className="bg-surface border border-rule rounded-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCollapse(g.id)}
                className="w-full text-left px-5 py-4 border-b border-rule flex items-center justify-between gap-4 hover:bg-bg-elevated transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${g.isOrphan ? "bg-red" : "bg-emerald"}`} />
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-ink-strong leading-tight truncate">
                      {g.name}
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5 truncate">
                      {g.role ? `${g.role}` : g.isOrphan ? "Triage these into an engineer" : "—"}
                      {g.internalType && <span className="text-ink-faint"> · {g.internalType}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 text-right shrink-0">
                  <div className="hidden sm:block">
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider font-mono">Active</div>
                    <div className="text-[14px] font-semibold text-ink-strong tabnum">{g.totals.activeCount}</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider font-mono">Assigned hrs</div>
                    <div className="text-[14px] font-semibold text-ink-strong tabnum">{g.totals.activeHoursAssigned}h</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider font-mono">Worked hrs</div>
                    <div className="text-[14px] font-semibold text-emerald tabnum">{g.totals.activeHoursWorked}h</div>
                  </div>
                  <span className="text-ink-faint text-[14px] font-mono w-3 shrink-0">
                    {isCollapsed ? "+" : "−"}
                  </span>
                </div>
              </button>

              {!isCollapsed && (
                <>
                  {/* Per-engineer status mini-strip + scorecard link */}
                  <div className="px-5 py-2.5 bg-bg-elevated border-b border-rule flex items-center justify-between gap-4 text-[11px] font-mono text-ink-muted tabnum flex-wrap">
                    <div className="flex items-center gap-4 flex-wrap">
                      {g.totals.inProgressCount > 0 && (
                        <span><span className="text-emerald">●</span> {g.totals.inProgressCount} in progress</span>
                      )}
                      {g.totals.todoCount > 0 && (
                        <span><span className="text-ink-faint">●</span> {g.totals.todoCount} todo</span>
                      )}
                      {g.totals.qaCount > 0 && (
                        <span><span className="text-sky">●</span> {g.totals.qaCount} QA</span>
                      )}
                      {g.totals.onHoldCount > 0 && (
                        <span><span className="text-amber">●</span> {g.totals.onHoldCount} hold</span>
                      )}
                      {g.totals.doneCount > 0 && (
                        <span><span className="text-violet">●</span> {g.totals.doneCount} done</span>
                      )}
                    </div>
                    {!g.isOrphan && (
                      <Link
                        href={`/me?as=${g.id}`}
                        className="text-emerald hover:text-emerald/80 transition-colors font-mono whitespace-nowrap"
                      >
                        View scorecard →
                      </Link>
                    )}
                  </div>

                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {g.visibleStories.map((s) => (
                      <StoryCard
                        key={s.id}
                        story={s}
                        onClick={setSelected}
                        selected={selected?.id === s.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      <StorySheet
        story={selected}
        engineers={assignableEngineers}
        sprints={data.sprintOptions}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onFilterByEngineer={(engineerId) => {
          setFilter({ ...EMPTY_FILTER, engineerId });
          setSelected(null);
        }}
        onFilterByClient={(client) => {
          setFilter({ ...EMPTY_FILTER, client });
          setSelected(null);
        }}
      />
    </>
  );
}
