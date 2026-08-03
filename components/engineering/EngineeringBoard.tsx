"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EngineeringBoardData, Story } from "@/lib/engineering-types";
import { StatCard } from "@/components/ui/StatCard";
import { StorySheet } from "./StorySheet";
import { EngineeringFilterBar } from "./FilterBar";
import { RosterRow } from "./RosterRow";
import { EMPTY_FILTER, Filter, STATUS_GROUPS } from "./types";
import { useSearchParamsFilter } from "@/lib/use-search-params-filter";

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
  if (f.priority && s.priority !== f.priority) return false;
  return true;
}

export function EngineeringBoard({ data, canEdit = false }: Props) {
  const [filter, setFilter] = useSearchParamsFilter<Filter>({
    defaults: EMPTY_FILTER,
    keys: ["search", "status", "engineerId", "client", "sprintNumber", "priority", "orphanOnly"],
  });
  const [selected, setSelected] = useState<Story | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["__free__"]));

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

  const inProgressNow = useMemo(
    () => data.groups.reduce((sum, g) => sum + g.totals.inProgressCount, 0),
    [data.groups],
  );

  const roster = useMemo(() => {
    const orphan = filtered.find((g) => g.isOrphan);
    const engineers = filtered.filter((g) => !g.isOrphan);
    const working = engineers
      .filter((g) => g.visibleStories.length > 0)
      .sort(
        (a, b) =>
          b.totals.inProgressCount - a.totals.inProgressCount ||
          b.totals.activeHoursAssigned - a.totals.activeHoursAssigned,
      );
    // Engineers with no visible stories under the current filter + assignable
    // people who have no story group at all — folded into one "free" row.
    const groupIds = new Set(engineers.map((g) => g.id));
    const free: { id: string; name: string; role: string | null }[] = [
      ...engineers
        .filter((g) => g.visibleStories.length === 0)
        .map((g) => ({ id: g.id, name: g.name, role: g.role })),
      ...data.assignablePeople
        .filter((p) => !groupIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, role: p.role })),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const maxAssigned = Math.max(
      ...working.map((g) => g.totals.activeHoursAssigned),
      1,
    );
    return { orphan, working, free, maxAssigned };
  }, [filtered, data.assignablePeople]);

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
          label="In progress now"
          tone="emerald"
          value={inProgressNow.toLocaleString()}
          sub="Being worked on right now"
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
          label="QA queue"
          tone={data.totals.qaReviewCount > 0 ? "amber" : "neutral"}
          value={data.totals.qaReviewCount.toLocaleString()}
          sub="Waiting on review"
          active={filter.status === "qa"}
          onClick={() =>
            setFilter(
              filter.status === "qa"
                ? { ...filter, status: "active" }
                : { ...EMPTY_FILTER, status: "qa" },
            )
          }
        />
      </div>

      <EngineeringFilterBar
        filter={filter}
        setFilter={setFilter}
        engineers={engineersWithWork}
        clients={data.clients}
        sprints={data.sprints}
        totalStories={data.totals.totalStories}
        filteredCount={filteredCount}
      />

      {/* Unified roster */}
      <div className="space-y-3">
        {roster.orphan && roster.orphan.visibleStories.length > 0 && (
          <RosterRow
            group={roster.orphan}
            stories={roster.orphan.visibleStories}
            maxAssigned={roster.maxAssigned}
            expanded={!collapsed.has("__orphan__")}
            onToggle={() => toggleCollapse("__orphan__")}
            selectedId={selected?.id ?? null}
            onSelectStory={setSelected}
          />
        )}

        {roster.working.map((g) => (
          <RosterRow
            key={g.id}
            group={g}
            stories={g.visibleStories}
            maxAssigned={roster.maxAssigned}
            expanded={!collapsed.has(g.id)}
            onToggle={() => toggleCollapse(g.id)}
            selectedId={selected?.id ?? null}
            onSelectStory={setSelected}
          />
        ))}

        {roster.working.length === 0 && !roster.orphan && (
          <div className="text-center py-12 text-ink-muted text-[13px]">
            No stories match the current filter.
          </div>
        )}

        {roster.free.length > 0 && !filter.orphanOnly && (
          <section className="bg-surface border border-rule rounded-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCollapse("__free__")}
              className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-bg-elevated transition-colors"
            >
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-ink-strong">
                  {roster.free.length} engineer{roster.free.length === 1 ? "" : "s"} free
                </span>
                <span className="ml-2 text-[12px] text-ink-muted truncate">
                  {roster.free.map((p) => p.name).join(" · ")}
                </span>
              </div>
              <span className="text-ink-faint text-[14px] font-mono w-3 shrink-0">
                {collapsed.has("__free__") ? "+" : "−"}
              </span>
            </button>
            {!collapsed.has("__free__") && (
              <div className="border-t border-rule divide-y divide-rule">
                {roster.free.map((p) => (
                  <div
                    key={p.id}
                    className="px-5 py-2.5 flex items-center justify-between gap-4 text-[12px]"
                  >
                    <div className="min-w-0">
                      <span className="text-ink-strong font-medium">{p.name}</span>
                      <span className="ml-2 text-ink-muted">{p.role ?? "Engineer"}</span>
                      <span className="ml-2 text-ink-faint">· no active stories</span>
                    </div>
                    <Link
                      href={`/me?as=${p.id}`}
                      className="text-emerald hover:text-emerald/80 transition-colors font-mono text-[11px] whitespace-nowrap"
                    >
                      View scorecard →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
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
