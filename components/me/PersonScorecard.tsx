"use client";

import { useState } from "react";
import { Scorecard, ScorecardEngineer } from "@/lib/scorecard-types";
import { Story, COMMISSION_RATE } from "@/lib/engineering-types";
import { StatCard } from "@/components/ui/StatCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { GoalBar } from "@/components/home/GoalBar";
import { StoryCard } from "@/components/engineering/StoryCard";
import { StorySheet } from "@/components/engineering/StorySheet";
import { PersonPicker } from "./PersonPicker";

type Props = {
  scorecard: Scorecard;
  engineers: ScorecardEngineer[];
  canEdit?: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function bonusTierLabel(tier: Scorecard["company"]["bonusTier"]): string {
  switch (tier) {
    case "tier2": return "15% tier · unlocked";
    case "tier1": return "10% tier · unlocked";
    default: return "Locked";
  }
}

function bonusTierTone(tier: Scorecard["company"]["bonusTier"]): "emerald" | "amber" | "red" {
  switch (tier) {
    case "tier2": return "emerald";
    case "tier1": return "emerald";
    default: return "amber";
  }
}

function levelFromRole(role: string | null): string {
  if (!role) return "—";
  const match = role.match(/L[1-7]/i);
  return match ? match[0].toUpperCase() : role;
}

export function PersonScorecard({ scorecard, engineers, canEdit = false }: Props) {
  const [selected, setSelected] = useState<Story | null>(null);
  const { engineer, totals, nextToShip, byStatus, company } = scorecard;

  const totalPotential = totals.openInvoice + totals.earnedInvoice;
  const totalPotentialCommission = totalPotential * COMMISSION_RATE;
  const earnedPctOfTotal = totalPotential > 0
    ? (totals.earnedInvoice / totalPotential) * 100
    : 0;

  const groups: { label: string; tone: string; stories: Story[] }[] = [
    { label: "In progress", tone: "emerald", stories: byStatus.inProgress },
    { label: "Todo", tone: "neutral", stories: byStatus.todo },
    { label: "QA Review", tone: "sky", stories: byStatus.qa },
    { label: "On Hold", tone: "amber", stories: byStatus.onHold },
    { label: "Completed", tone: "violet", stories: byStatus.done },
  ];

  return (
    <>
      {/* Header strip */}
      <div className="mb-6 pb-4 border-b border-rule">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                /me — Personal Scorecard
              </span>
            </div>
            <h1 className="text-[24px] font-semibold text-ink-strong leading-tight">
              {engineer.name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-muted">
              <span className="px-2 py-0.5 bg-bg-elevated border border-rule rounded font-mono uppercase tracking-wider text-[10px]">
                {levelFromRole(engineer.role)}
              </span>
              {engineer.role && <span>{engineer.role}</span>}
              {engineer.internalType && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span>{engineer.internalType}</span>
                </>
              )}
            </div>
          </div>
          <PersonPicker current={engineer.id} engineers={engineers} />
        </div>
      </div>

      {/* Bonus tier callout */}
      <div className="mb-6">
        <SectionTitle
          title="Company Bonus Pool"
          aside={
            <span className={`font-mono text-[11px] ${
              company.bonusTier === "locked" ? "text-amber" : "text-emerald"
            }`}>
              {bonusTierLabel(company.bonusTier)}
            </span>
          }
        />
        <GoalBar
          label="Annual Revenue"
          value={company.ytdRevenue}
          target={company.revenueGoal}
          stretch={company.bonusStretch}
          formatValue={fmtMoney}
          tone={bonusTierTone(company.bonusTier)}
          rightLabel={
            company.bonusTier === "tier2"
              ? "Maxed"
              : company.bonusTier === "tier1"
                ? "10% tier"
                : "Locked"
          }
          sub={
            company.bonusTier === "tier2"
              ? "Bonus pool is fully funded at 15% of revenue. Lock in your delivery."
              : company.bonusTier === "tier1"
                ? `10% pool is open. ${fmtMoney(company.bonusStretch - company.ytdRevenue)} more unlocks the 15% pool — about ${Math.ceil((company.bonusStretch - company.ytdRevenue) / 12 / 1000)}K/mo if we keep pace.`
                : `${fmtMoney(company.revenueGoal - company.ytdRevenue)} more in revenue unlocks the 10% bonus pool. Ship to make it happen.`
          }
        />
      </div>

      {/* Personal stats strip */}
      <SectionTitle title="Your Numbers" aside={`${Math.round(COMMISSION_RATE * 100)}% commission per story`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Open commission"
          tone="emerald"
          value={fmtMoney(totals.openCommission)}
          sub={`${fmtMoney(totals.openInvoice)} of open scope`}
        />
        <StatCard
          label="Earned commission"
          tone="violet"
          value={fmtMoney(totals.earnedCommission)}
          sub={`${totals.doneCount} stories shipped · ${fmtMoney(totals.earnedInvoice)} delivered`}
        />
        <StatCard
          label="Active"
          value={totals.activeCount.toLocaleString()}
          sub={`${totals.inProgressCount} in progress · ${totals.todoCount} todo · ${totals.qaCount} QA`}
        />
        <StatCard
          label="Pipeline potential"
          tone="sky"
          value={fmtMoney(totalPotentialCommission)}
          sub={`If you ship all open work · ${Math.round(earnedPctOfTotal)}% earned so far`}
        />
      </div>

      {/* Earned-vs-total progress */}
      {totalPotential > 0 && (
        <div className="mb-8">
          <SectionTitle title="Lifetime Progress" />
          <GoalBar
            label="Commission earned"
            value={totals.earnedCommission}
            target={totalPotentialCommission}
            formatValue={fmtMoney}
            tone="emerald"
            rightLabel="of total scoped to you"
            sub={`${totals.doneCount} of ${totals.doneCount + totals.activeCount + totals.onHoldCount} stories complete`}
          />
        </div>
      )}

      {/* Next 3 to ship */}
      {nextToShip.length > 0 && (
        <div className="mb-8">
          <SectionTitle
            title="Next to Ship"
            aside={`Highest-value active stories · ship these to earn ${fmtMoney(nextToShip.reduce((s, n) => s + n.commission, 0))}`}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {nextToShip.map((s) => (
              <StoryCard key={s.id} story={s} onClick={setSelected} selected={selected?.id === s.id} />
            ))}
          </div>
        </div>
      )}

      {/* All stories grouped by status */}
      <SectionTitle
        title="All Your Stories"
        aside={`${totals.storyCount} total`}
      />
      <div className="space-y-6">
        {groups.map((g) => {
          if (g.stories.length === 0) return null;
          const sectionTotal = g.stories.reduce((sum, s) => sum + s.commission, 0);
          return (
            <section key={g.label} className="bg-surface border border-rule rounded-card overflow-hidden">
              <div className="px-5 py-3 border-b border-rule flex items-center justify-between bg-bg-elevated">
                <div className="text-[13px] font-semibold text-ink-strong flex items-center gap-2">
                  <span>{g.label}</span>
                  <span className="text-[11px] text-ink-muted font-mono tabnum">
                    ({g.stories.length})
                  </span>
                </div>
                <span className="text-[12px] font-semibold text-emerald tabnum">
                  {fmtMoney(sectionTotal)}
                </span>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {g.stories.map((s) => (
                  <StoryCard
                    key={s.id}
                    story={s}
                    onClick={setSelected}
                    selected={selected?.id === s.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <StorySheet
        story={selected}
        engineers={engineers.filter((e) => !e.isOrphan).map((e) => ({ id: e.id, name: e.name }))}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onFilterByEngineer={() => setSelected(null)}
        onFilterByClient={() => setSelected(null)}
      />
    </>
  );
}
