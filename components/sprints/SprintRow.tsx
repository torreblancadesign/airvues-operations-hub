"use client";

import Link from "next/link";
import { SprintSummary } from "@/lib/sprints-types";

type Props = {
  sprint: SprintSummary;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

function statusPill(status: string | null): { text: string; cls: string } {
  switch (status) {
    case "In Progress": return { text: "In Progress", cls: "bg-emerald/15 text-emerald border-emerald/30" };
    case "Next": return { text: "Next", cls: "bg-sky/15 text-sky border-sky/30" };
    case "Done": return { text: "Done", cls: "bg-violet/15 text-violet border-violet/30" };
    default: return { text: "—", cls: "bg-bg-elevated text-ink-faint border-rule" };
  }
}

export function SprintRow({ sprint }: Props) {
  const pill = statusPill(sprint.status);
  const start = fmtDate(sprint.start);
  const end = fmtDate(sprint.end);
  const dateRange = start && end ? `${start} → ${end}` : start ?? "—";

  // Restructured: outer is a plain div with two sibling Links (kanban + plan).
  // Previous nested-Link structure caused invalid HTML + hydration warnings.
  return (
    <div className="bg-surface border border-rule rounded-card hover:border-rule-strong transition-colors overflow-hidden group">
      <Link href={`/sprints/${sprint.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${pill.cls}`}>
                {pill.text}
              </span>
              <span className="text-[11px] font-mono text-ink-faint tabnum">
                {dateRange}
              </span>
            </div>
            <div className="text-[15px] font-semibold text-ink-strong leading-tight group-hover:text-emerald transition-colors">
              {sprint.number != null ? `Sprint #${sprint.number}` : sprint.name}
            </div>
            {sprint.goals && (
              <div className="text-[12px] text-ink-muted leading-snug mt-0.5 line-clamp-1">
                {sprint.goals}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
              Completion
            </div>
            <div className="text-[16px] font-semibold text-ink-strong tabnum">
              {Math.round(sprint.completionPct)}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-emerald rounded-full"
            style={{ width: `${Math.min(100, sprint.completionPct)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted tabnum flex-wrap gap-2">
          <span>
            <span className="text-violet">{sprint.doneCount}</span>
            <span className="text-ink-faint"> / </span>
            {sprint.storyCount} done
          </span>
          <span>{sprint.hoursScoped.toFixed(0)}h scoped</span>
          <span>{fmtMoney(sprint.invoice)} scope</span>
          <span className="text-emerald">{fmtMoney(sprint.commission)} comm</span>
        </div>
      </Link>

      <div className="px-4 py-2.5 border-t border-rule bg-bg-elevated/40 flex items-center justify-between gap-2 text-[11px] font-mono text-ink-faint">
        <span>Click card for kanban</span>
        <Link
          href={`/sprints/${sprint.id}/plan`}
          className="text-emerald hover:underline whitespace-nowrap"
        >
          Plan →
        </Link>
      </div>
    </div>
  );
}
