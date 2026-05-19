"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EngineerGroup, COMMISSION_RATE } from "@/lib/engineering-types";

type Props = {
  groups: EngineerGroup[];
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type SortMode = "earned" | "open" | "shipped";

const SORT_LABELS: Record<SortMode, string> = {
  earned: "Earned commission (lifetime)",
  open: "Open commission (potential)",
  shipped: "Stories shipped",
};

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function Leaderboard({ groups }: Props) {
  const [sort, setSort] = useState<SortMode>("earned");

  const ranked = useMemo(() => {
    const eligible = groups.filter((g) => !g.isOrphan);
    return [...eligible].sort((a, b) => {
      if (sort === "earned") return b.totals.earnedCommission - a.totals.earnedCommission;
      if (sort === "open") return b.totals.openCommission - a.totals.openCommission;
      return b.totals.doneCount - a.totals.doneCount;
    });
  }, [groups, sort]);

  if (ranked.length === 0) return null;

  const top = ranked[0];
  const topValue =
    sort === "earned"
      ? top.totals.earnedCommission
      : sort === "open"
        ? top.totals.openCommission
        : top.totals.doneCount;

  return (
    <div className="bg-surface border border-rule rounded-card overflow-hidden mb-4">
      <div className="px-5 py-3 border-b border-rule flex items-center justify-between gap-2 flex-wrap bg-bg-elevated">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-0.5">
            Leaderboard
          </div>
          <div className="text-[13px] font-semibold text-ink-strong">
            Top contributors · {Math.round(COMMISSION_RATE * 100)}% commission per story
          </div>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="px-2.5 py-1 text-[11px] bg-surface border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none cursor-pointer"
        >
          {Object.entries(SORT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-rule">
        {ranked.slice(0, 5).map((g, i) => {
          const rank = i + 1;
          const value =
            sort === "earned"
              ? g.totals.earnedCommission
              : sort === "open"
                ? g.totals.openCommission
                : g.totals.doneCount;
          const pct = topValue > 0 && rank > 1 ? (value / topValue) * 100 : 100;
          const isTop = rank === 1;
          const display = sort === "shipped" ? value.toLocaleString() : fmtMoney(value);

          return (
            <Link
              key={g.id}
              href={`/me?as=${g.id}`}
              className="block px-5 py-3 hover:bg-bg-elevated transition-colors group"
            >
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-[16px] w-8 shrink-0 tabnum font-mono">
                  {medal(rank)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink-strong group-hover:text-emerald transition-colors truncate">
                    {g.name}
                  </div>
                  <div className="text-[10px] text-ink-muted truncate">
                    {g.role ?? "Engineer"}
                    {g.internalType && <span className="text-ink-faint"> · {g.internalType}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[14px] font-semibold tabnum ${isTop ? "text-emerald" : "text-ink-strong"}`}>
                    {display}
                  </div>
                  <div className="text-[10px] text-ink-faint font-mono">
                    {sort === "earned"
                      ? `${g.totals.doneCount} stories shipped`
                      : sort === "open"
                        ? `${g.totals.activeCount} open stories`
                        : `${fmtMoney(g.totals.earnedCommission)} earned`}
                  </div>
                </div>
              </div>
              <div className="h-1 bg-bg-elevated rounded-full overflow-hidden ml-11">
                <div
                  className="h-full bg-emerald rounded-full transition-all"
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>

      {ranked.length > 5 && (
        <div className="px-5 py-2 bg-bg-elevated text-[11px] text-ink-faint font-mono">
          + {ranked.length - 5} more engineers below the fold
        </div>
      )}
    </div>
  );
}
