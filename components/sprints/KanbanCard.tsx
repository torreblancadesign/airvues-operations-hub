"use client";

import { useTransition } from "react";
import { Story, COMMISSION_RATE } from "@/lib/engineering-types";
import { KanbanColumn, NEXT_STATUS } from "@/lib/sprints-types";
import { updateStory } from "@/lib/mutations/story";

type Props = {
  story: Story;
  column: KanbanColumn;
  canEdit: boolean;
  onOpen: (s: Story) => void;
  onAdvanced?: () => void;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function priorityDot(p: string | null): string {
  switch (p) {
    case "Urgent": return "bg-red";
    case "High": return "bg-amber";
    case "Medium": return "bg-sky";
    case "Low": return "bg-ink-faint";
    default: return "bg-bg-elevated";
  }
}

function payStatusTone(s: string): string {
  const v = s.toLowerCase();
  if (v.includes("paid") && !v.includes("partial") && !v.includes("unpaid")) return "bg-emerald/15 text-emerald border-emerald/30";
  if (v.includes("partial") || v.includes("deposit")) return "bg-amber/15 text-amber border-amber/30";
  if (v.includes("unpaid") || v.includes("overdue") || v.includes("past due")) return "bg-red/15 text-red border-red/30";
  return "bg-bg-elevated text-ink-muted border-rule";
}

export function KanbanCard({ story, column, canEdit, onOpen, onAdvanced }: Props) {
  const [pending, startTransition] = useTransition();
  const nextStatus = NEXT_STATUS[column];

  const pct = story.hours && story.hours > 0
    ? Math.min(100, Math.round(((story.hoursWorked ?? 0) / story.hours) * 100))
    : null;
  const over = pct != null && pct > 100;
  const assignee = story.assigneeNames[0];

  function advance(e: React.MouseEvent) {
    e.stopPropagation();
    if (!nextStatus) return;
    startTransition(async () => {
      await updateStory(story.id, { status: nextStatus });
      onAdvanced?.();
    });
  }

  function ship(e: React.MouseEvent) {
    e.stopPropagation();
    if (column === "Completed") return;
    startTransition(async () => {
      await updateStory(story.id, { status: "Completed" });
      onAdvanced?.();
    });
  }

  return (
    <div
      onClick={() => onOpen(story)}
      className={`bg-surface border border-rule rounded-md p-3 cursor-pointer hover:border-rule-strong transition-all group ${
        pending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {story.priority && (
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot(story.priority)}`}
              aria-label={story.priority}
            />
          )}
          <span className="text-[10px] font-mono text-ink-faint">
            #{story.storyNumber ?? "?"}
          </span>
          {story.clientNames[0] && (
            <span className="text-[10px] text-ink-muted truncate">
              · {story.clientNames[0]}
            </span>
          )}
        </div>
        <span className="text-[12px] font-semibold text-ink-strong tabnum shrink-0">
          {fmtMoney(story.invoice)}
        </span>
      </div>

      {story.payStatus[0] && (
        <div className="mb-1.5">
          <span
            className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${payStatusTone(story.payStatus[0])}`}
            title={story.payStatus.join(", ")}
          >
            {story.payStatus[0]}
          </span>
        </div>
      )}

      <div className="text-[13px] text-ink-strong font-medium leading-snug mb-2 line-clamp-2 group-hover:text-emerald transition-colors">
        {story.name}
      </div>

      {pct != null && (
        <div className="mb-2">
          <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${over ? "bg-red" : "bg-emerald"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-0.5 text-[10px] font-mono text-ink-faint tabnum">
            {story.hoursWorked ?? 0}h / {story.hours}h
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-rule">
        <span className="text-[11px] text-ink-muted truncate min-w-0">
          {assignee ?? <span className="text-red">Unassigned</span>}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-emerald tabnum">
            {fmtMoney(story.invoice * COMMISSION_RATE)}
          </span>
          {canEdit && nextStatus && (
            <button
              type="button"
              onClick={advance}
              disabled={pending}
              title={`Advance to ${nextStatus}`}
              className="w-6 h-6 flex items-center justify-center rounded bg-bg-elevated border border-rule hover:border-emerald hover:text-emerald text-ink-muted transition-colors disabled:opacity-50"
              aria-label={`Advance to ${nextStatus}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
          {canEdit && column !== "Completed" && (
            <button
              type="button"
              onClick={ship}
              disabled={pending}
              title="Ship — mark Completed"
              className="w-6 h-6 flex items-center justify-center rounded bg-bg-elevated border border-rule hover:border-violet hover:text-violet text-ink-muted transition-colors disabled:opacity-50"
              aria-label="Ship — mark Completed"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
