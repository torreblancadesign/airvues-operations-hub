"use client";

import { useMemo } from "react";
import { EngineerGroup } from "@/lib/engineering-types";

type Props = {
  groups: EngineerGroup[];
};

export function CapacityPanel({ groups }: Props) {
  const ranked = useMemo(() => {
    const eligible = groups.filter((g) => !g.isOrphan);
    return [...eligible].sort(
      (a, b) => b.totals.activeHoursAssigned - a.totals.activeHoursAssigned,
    );
  }, [groups]);

  if (ranked.length === 0) return null;

  const maxHours = Math.max(...ranked.map((g) => g.totals.activeHoursAssigned), 1);

  return (
    <div className="bg-surface border border-rule rounded-card overflow-hidden mb-4">
      <div className="px-5 py-3 border-b border-rule bg-bg-elevated">
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-0.5">
          Capacity Planning
        </div>
        <div className="text-[13px] font-semibold text-ink-strong">
          Active workload per engineer · hours assigned on non-complete stories
        </div>
      </div>

      <div className="divide-y divide-rule">
        {ranked.map((g) => {
          const assigned = g.totals.activeHoursAssigned;
          const worked = g.totals.activeHoursWorked;
          const pct = assigned > 0 ? Math.min(100, (assigned / maxHours) * 100) : 0;
          const workedPct = assigned > 0 ? Math.min(999, Math.round((worked / assigned) * 100)) : null;
          const over = workedPct != null && workedPct > 100;

          return (
            <div key={g.id} className="px-5 py-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink-strong truncate">
                    {g.name}
                  </div>
                  <div className="text-[10px] text-ink-muted truncate">
                    {g.role ?? "Engineer"}
                    {g.internalType && <span className="text-ink-faint"> · {g.internalType}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right shrink-0">
                  <div>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider font-mono">Active</div>
                    <div className="text-[14px] font-semibold text-ink-strong tabnum">{g.totals.activeCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider font-mono">Assigned</div>
                    <div className="text-[14px] font-semibold text-ink-strong tabnum">{assigned}h</div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider font-mono">Worked</div>
                    <div className={`text-[14px] font-semibold tabnum ${over ? "text-red" : "text-emerald"}`}>
                      {worked}h{workedPct != null && <span className="text-[11px] text-ink-faint ml-1">· {workedPct}%</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald rounded-full transition-all"
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>

              <div className="mt-1.5 flex items-center gap-3 text-[10px] font-mono text-ink-faint tabnum flex-wrap">
                {g.totals.inProgressCount > 0 && (
                  <span><span className="text-emerald">●</span> {g.totals.inProgressCount} in progress</span>
                )}
                {g.totals.todoCount > 0 && (
                  <span><span className="text-ink-faint">●</span> {g.totals.todoCount} todo</span>
                )}
                {g.totals.qaCount > 0 && (
                  <span><span className="text-sky">●</span> {g.totals.qaCount} QA</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
