"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Story } from "@/lib/engineering-types";
import { SprintDetail, KANBAN_COLUMNS, KanbanColumn } from "@/lib/sprints-types";
import { StatCard } from "@/components/ui/StatCard";
import { StorySheet } from "@/components/engineering/StorySheet";
import { KanbanCard } from "./KanbanCard";

type EngineerOption = { id: string; name: string };
type SprintOption = { id: string; number: number | null; status: string | null };

type Props = {
  sprint: SprintDetail;
  engineers: EngineerOption[];
  sprints?: SprintOption[];
  canEdit: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function columnFor(status: string | null): KanbanColumn | null {
  if (status === "Todo" || status === "In progress" || status === "QA Review" || status === "Completed") {
    return status as KanbanColumn;
  }
  return null;
}

const COLUMN_META: Record<KanbanColumn, { color: string; bg: string }> = {
  Todo: { color: "text-ink-strong", bg: "bg-bg-elevated" },
  "In progress": { color: "text-emerald", bg: "bg-emerald/10" },
  "QA Review": { color: "text-sky", bg: "bg-sky/10" },
  Completed: { color: "text-violet", bg: "bg-violet/10" },
};

export function SprintBoard({ sprint, engineers, sprints = [], canEdit }: Props) {
  const router = useRouter();
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [openStory, setOpenStory] = useState<Story | null>(null);

  const filtered = useMemo(() => {
    if (!assigneeFilter) return sprint.stories;
    if (assigneeFilter === "__orphan__") {
      return sprint.stories.filter((s) => s.assigneeIds.length === 0);
    }
    return sprint.stories.filter((s) => s.assigneeIds.includes(assigneeFilter));
  }, [sprint.stories, assigneeFilter]);

  const byColumn = useMemo(() => {
    const map: Record<KanbanColumn, Story[]> = {
      Todo: [],
      "In progress": [],
      "QA Review": [],
      Completed: [],
    };
    for (const s of filtered) {
      const col = columnFor(s.status);
      if (col) map[col].push(s);
    }
    return map;
  }, [filtered]);

  const offBoardStories = useMemo(
    () => filtered.filter((s) => !columnFor(s.status)),
    [filtered],
  );

  function onAdvanced() {
    // Server Action already revalidated cache tags; refresh server data.
    router.refresh();
  }

  return (
    <>
      {/* Sprint stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Completion"
          tone={sprint.completionPct >= 100 ? "violet" : sprint.completionPct >= 50 ? "emerald" : "amber"}
          value={`${Math.round(sprint.completionPct)}%`}
          sub={`${sprint.doneCount} of ${sprint.storyCount} stories shipped`}
        />
        <StatCard
          label="Stories"
          value={sprint.storyCount.toLocaleString()}
          sub={`${sprint.inProgressCount} in progress · ${sprint.qaCount} QA · ${sprint.todoCount} todo`}
        />
        <StatCard
          label="Sprint scope"
          tone="emerald"
          value={fmtMoney(sprint.invoice)}
          sub={`${fmtMoney(sprint.commission)} commission @ 15% · ${sprint.hoursScoped.toFixed(0)}h scoped`}
        />
        <StatCard
          label="Hours worked"
          value={`${sprint.hoursWorked.toFixed(0)}h`}
          sub={`${sprint.hoursScoped > 0 ? Math.round((sprint.hoursWorked / sprint.hoursScoped) * 100) : 0}% of scoped`}
        />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setAssigneeFilter(null)}
          className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
            assigneeFilter === null
              ? "bg-emerald/15 border-emerald text-emerald"
              : "bg-bg-elevated border-rule text-ink-muted hover:border-ink-muted hover:text-ink-strong"
          }`}
        >
          All ({sprint.stories.length})
        </button>
        <button
          type="button"
          onClick={() => setAssigneeFilter("__orphan__")}
          className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
            assigneeFilter === "__orphan__"
              ? "bg-red/15 border-red text-red"
              : "bg-bg-elevated border-rule text-ink-muted hover:border-ink-muted hover:text-ink-strong"
          }`}
        >
          Unassigned
        </button>
        {engineers.map((e) => {
          const count = sprint.stories.filter((s) => s.assigneeIds.includes(e.id)).length;
          if (count === 0) return null;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setAssigneeFilter(e.id)}
              className={`px-2.5 py-1 text-[11px] rounded border transition-colors ${
                assigneeFilter === e.id
                  ? "bg-emerald/15 border-emerald text-emerald"
                  : "bg-bg-elevated border-rule text-ink-muted hover:border-ink-muted hover:text-ink-strong"
              }`}
            >
              {e.name.split(" ")[0]} ({count})
            </button>
          );
        })}
      </div>

      {/* Off-board banner — stories in this sprint with statuses outside the kanban pipeline */}
      {offBoardStories.length > 0 && (
        <div className="mb-3 bg-amber/10 border border-amber/30 rounded-md px-4 py-2.5 text-[12px]">
          <span className="font-semibold text-amber">
            {offBoardStories.length} {offBoardStories.length === 1 ? "story is" : "stories are"} off the board
          </span>
          <span className="text-ink-muted">
            {" · "}
            statuses outside the active pipeline:{" "}
            {[...new Set(offBoardStories.map((s) => s.status))].join(", ")}.
            Open in the drawer to move back into Todo / In progress / QA Review / Completed.
          </span>
        </div>
      )}

      {/* Kanban — 4 columns on lg, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {KANBAN_COLUMNS.map((col) => {
          const stories = byColumn[col];
          const meta = COLUMN_META[col];
          const colScope = stories.reduce((sum, s) => sum + s.invoice, 0);
          return (
            <div key={col} className="bg-surface border border-rule rounded-card overflow-hidden flex flex-col min-h-[200px]">
              <div className={`px-3 py-2.5 border-b border-rule ${meta.bg} flex items-center justify-between`}>
                <div className={`text-[12px] font-semibold uppercase tracking-wider ${meta.color}`}>
                  {col}
                </div>
                <div className="text-[11px] font-mono text-ink-muted tabnum">
                  {stories.length} · {fmtMoney(colScope)}
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {stories.length === 0 && (
                  <div className="text-[11px] text-ink-faint text-center py-6">
                    Nothing here
                  </div>
                )}
                {stories.map((s) => (
                  <KanbanCard
                    key={s.id}
                    story={s}
                    column={col}
                    canEdit={canEdit}
                    onOpen={setOpenStory}
                    onAdvanced={onAdvanced}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <StorySheet
        story={openStory}
        engineers={engineers}
        sprints={sprints}
        canEdit={canEdit}
        onClose={() => setOpenStory(null)}
        onFilterByEngineer={(id) => {
          setAssigneeFilter(id);
          setOpenStory(null);
        }}
        onFilterByClient={() => setOpenStory(null)}
      />
    </>
  );
}
