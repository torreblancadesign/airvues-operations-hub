"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Story } from "@/lib/engineering-types";
import { OrphanTriageData } from "@/lib/orphan-triage-types";
import { StatCard } from "@/components/ui/StatCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { GoalBar } from "@/components/home/GoalBar";
import { StorySheet } from "@/components/engineering/StorySheet";
import { OrphanGroupCard } from "./OrphanGroupCard";

type Props = {
  data: OrphanTriageData;
  canEdit: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function OrphanTriage({ data, canEdit }: Props) {
  const [search, setSearch] = useState("");
  const [assignedCount, setAssignedCount] = useState(0);
  const [openStory, setOpenStory] = useState<Story | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return data.groups;
    const q = search.toLowerCase();
    return data.groups.filter((g) => {
      if (g.quoteLabel.toLowerCase().includes(q)) return true;
      if (g.client?.toLowerCase().includes(q)) return true;
      if (g.suggestedEngineerName?.toLowerCase().includes(q)) return true;
      return g.stories.some((s) => s.name.toLowerCase().includes(q));
    });
  }, [data.groups, search]);

  const remaining = data.totalOrphans - assignedCount;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Orphan stories"
          tone={data.totalOrphans > 0 ? "red" : "emerald"}
          value={data.totalOrphans.toLocaleString()}
          sub={`${data.groups.length} quote groups · ${data.ungroupedCount} ungrouped`}
        />
        <StatCard
          label="Scope locked up"
          tone="amber"
          value={fmtMoney(data.totalInvoice)}
          sub="Invoice $ of unassigned work"
        />
        <StatCard
          label="Commission unallocated"
          tone="emerald"
          value={fmtMoney(data.totalCommission)}
          sub="15% of scope · waiting for engineer attribution"
        />
        <StatCard
          label="This session"
          tone="violet"
          value={assignedCount.toLocaleString()}
          sub={`${remaining.toLocaleString()} remaining · refresh to see progress`}
        />
      </div>

      <GoalBar
        label="Triage progress"
        value={assignedCount}
        target={Math.max(1, data.totalOrphans)}
        formatValue={(n) => `${Math.round(n)}`}
        tone="emerald"
        rightLabel="this session"
        sub={`${assignedCount} of ${data.totalOrphans} orphans cleared. Refresh the page to recompute against fresh data.`}
      />

      <div className="mt-6 mb-4 flex items-center gap-2 flex-wrap">
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quote, client, story, or suggested engineer..."
            className="pl-8 w-full px-2.5 py-1.5 text-[12px] bg-surface border border-rule text-ink rounded-md focus:border-emerald focus:outline-none transition-colors"
          />
        </div>
        <Link
          href="/backlog?scope=orphan"
          className="px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong border border-rule hover:border-ink-muted rounded-md transition-colors whitespace-nowrap"
        >
          Or use /backlog →
        </Link>
      </div>

      <SectionTitle
        title="Quote groups"
        aside={`${filtered.length} shown · sorted by scope $ desc`}
      />

      {data.totalOrphans === 0 ? (
        <div className="bg-surface border border-rule rounded-card p-8 text-center">
          <div className="text-[24px] mb-2">🎉</div>
          <div className="text-[14px] font-semibold text-ink-strong mb-1">
            No orphan stories
          </div>
          <div className="text-[12px] text-ink-muted">
            Every active story has an engineer assigned. Engineering attribution is healthy.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-rule rounded-card p-6 text-center text-[12px] text-ink-muted">
          No groups match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => (
            <OrphanGroupCard
              key={g.groupKey}
              group={g}
              engineers={data.engineers}
              canEdit={canEdit}
              onAssigned={() => setAssignedCount((n) => n + g.stories.length)}
              onOpenStory={setOpenStory}
            />
          ))}
        </div>
      )}

      <StorySheet
        story={openStory}
        engineers={data.engineers}
        canEdit={canEdit}
        onClose={() => setOpenStory(null)}
        onFilterByEngineer={() => setOpenStory(null)}
        onFilterByClient={() => setOpenStory(null)}
      />
    </>
  );
}
