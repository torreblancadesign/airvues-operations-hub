"use client";

import { useState } from "react";
import Link from "next/link";
import { Scorecard, ScorecardEngineer } from "@/lib/scorecard-types";
import { Story } from "@/lib/engineering-types";
import { StatCard } from "@/components/ui/StatCard";
import { SectionTitle } from "@/components/ui/SectionTitle";

import { StoryCard } from "@/components/engineering/StoryCard";
import { StorySheet } from "@/components/engineering/StorySheet";
import { PersonPicker } from "./PersonPicker";
import { EarningsChart } from "./EarningsChart";
import { GoalEditor } from "./GoalEditor";


type Props = {
  scorecard: Scorecard;
  engineers: ScorecardEngineer[];
  canEdit?: boolean;
  canSwitchPerson?: boolean;
  canEditGoal?: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function levelFromRole(role: string | null): string {
  if (!role) return "—";
  const match = role.match(/L[1-7]/i);
  return match ? match[0].toUpperCase() : role;
}

export function PersonScorecard({ scorecard, engineers, canEdit = false, canSwitchPerson = false, canEditGoal = false }: Props) {
  const [selected, setSelected] = useState<Story | null>(null);
  const { engineer, totals, nextToShip, byStatus, earnings, payments, shipped, goal, shippedIsApproximate, commissionPct, commissionPctSource, commissionModel, salesCommission } = scorecard;
  const isSales = commissionModel === "sales";

  const totalPotentialCost = totals.openCost + totals.earnedCost;
  const totalPotentialCommission = totalPotentialCost * commissionPct;
  const pctLabel = `${(commissionPct * 100).toFixed(commissionPct * 100 % 1 === 0 ? 0 : 1)}%`;

  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsElapsed = now.getMonth() + now.getDate() / 30;
  const monthsRemaining = Math.max(0.1, 12 - monthsElapsed);

  // Goal pacing
  const annualGoal = goal.annualEarnings;
  const goalRemaining = annualGoal != null ? Math.max(0, annualGoal - earnings.ytd) : null;
  const monthlyPaceNeeded = goalRemaining != null ? goalRemaining / monthsRemaining : null;
  const expectedYtdAtPace = annualGoal != null ? (annualGoal / 12) * monthsElapsed : null;
  const onTrack = annualGoal != null && expectedYtdAtPace != null
    ? earnings.ytd >= expectedYtdAtPace
    : false;

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
              <span className="text-ink-faint">·</span>
              <span
                className="px-2 py-0.5 bg-bg-elevated border border-rule rounded font-mono uppercase tracking-wider text-[10px] text-emerald"
                title={
                  commissionPctSource === "person"
                    ? "Your commission rate from People.Commission Percentage"
                    : "Default rate — set Commission Percentage on your People record in Airtable"
                }
              >
                Commission · {pctLabel}
                {commissionPctSource === "default" && (
                  <span className="ml-1 text-ink-faint normal-case">(default)</span>
                )}
              </span>
            </div>
          </div>
          {canSwitchPerson && <PersonPicker current={engineer.id} engineers={engineers} />}
        </div>
      </div>

      {/* Earnings — real money paid out */}
      <SectionTitle title="Earnings" aside="From Team Task Payments · Status = Paid" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Lifetime paid"
          tone="emerald"
          value={fmtMoney(earnings.lifetime)}
          sub="All-time payouts"
        />
        <StatCard
          label={`Year to date · ${currentYear}`}
          tone="violet"
          value={fmtMoney(earnings.ytd)}
          sub={`Since Jan 1 · ${monthsElapsed.toFixed(1)} months elapsed`}
        />
        <StatCard
          label="Month to date"
          tone="sky"
          value={fmtMoney(earnings.mtd)}
          sub={`Since ${now.toLocaleString("default", { month: "long" })} 1`}
        />
        <StatCard
          label="Outstanding"
          tone={earnings.outstanding > 0 ? "amber" : "neutral"}
          value={fmtMoney(earnings.outstanding)}
          sub="Queued · Status = Needs Payment"
        />
      </div>

      {/* Earnings detail — monthly chart with drill-down */}
      <div className="mb-8">
        <SectionTitle
          title="Earnings Detail"
          aside={`${payments.length} payment${payments.length === 1 ? "" : "s"} · click a bar for details`}
        />
        <EarningsChart payments={payments} />
      </div>

      {/* Personal goal */}
      <div className="mb-8">
        <SectionTitle
          title={`${currentYear} Earnings Goal`}
          aside={
            annualGoal != null ? (
              <span className={`font-mono text-[11px] ${onTrack ? "text-emerald" : "text-amber"}`}>
                {onTrack ? "On pace" : "Behind pace"}
              </span>
            ) : null
          }
        />
        <GoalEditor
          personId={engineer.id}
          currentGoal={annualGoal}
          ytdEarnings={earnings.ytd}
          goalRemaining={goalRemaining}
          monthlyPaceNeeded={monthlyPaceNeeded}
          expectedYtdAtPace={expectedYtdAtPace}
          monthsRemaining={monthsRemaining}
          onTrack={onTrack}
          canEdit={canEditGoal}
        />
      </div>

      {/* Sales commission — shown for people on the Sales commission model */}
      {isSales && (
        <>
          <SectionTitle
            title="Commission Projections"
            aside={`From quotes you prepared · ${pctLabel} base${salesCommission.blueprintCount > 0 ? " + 5% Blueprint bonus" : ""}`}
          />
          {salesCommission.quoteCount === 0 && (
            <div className="mb-6 bg-surface border border-rule rounded-card p-4 text-[12px] text-ink-muted">
              No commission-eligible quotes yet. Quotes start counting once their Project Status moves past the proposal stage (Commencement Invoice Paid or later).
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard
              label="Lifetime earned"
              tone="emerald"
              value={fmtMoney(salesCommission.earned.lifetime)}
              sub={`From quotes at "Completion Invoice Paid"`}
            />
            <StatCard
              label={`YTD · ${currentYear}`}
              tone="violet"
              value={fmtMoney(salesCommission.earned.ytd)}
              sub={`Since Jan 1`}
            />
            <StatCard
              label="MTD"
              tone="sky"
              value={fmtMoney(salesCommission.earned.mtd)}
              sub={`This ${now.toLocaleString("default", { month: "long" })}`}
            />
            <StatCard
              label="Open pipeline"
              tone="amber"
              value={fmtMoney(salesCommission.open)}
              sub={`Projected from live quotes`}
            />
          </div>
          {salesCommission.blueprintCount > 0 && (
            <div className="mb-4 text-[11px] text-ink-muted font-mono">
              +{fmtMoney(salesCommission.blueprintBonus)} attributable to {salesCommission.blueprintCount} Blueprint quote{salesCommission.blueprintCount === 1 ? "" : "s"} (5% bonus)
            </div>
          )}
          <div className="mb-8 bg-surface border border-rule rounded-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-rule bg-bg-elevated flex items-center justify-between">
              <span className="text-[12px] font-semibold text-ink-strong">
                Prepared quotes
              </span>
              <span className="text-[11px] text-ink-muted font-mono tabnum">
                {salesCommission.quoteCount} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-ink-faint">
                  <tr className="border-b border-rule">
                    <th className="text-left px-4 py-2 font-medium">Project</th>
                    <th className="text-left px-3 py-2 font-medium">Client</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-right px-3 py-2 font-medium">Total Cost</th>
                    <th className="text-right px-3 py-2 font-medium">Rate</th>
                    <th className="text-right px-4 py-2 font-medium">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {salesCommission.quotes.map((q) => (
                    <tr key={q.id} className="border-b border-rule-soft last:border-0 hover:bg-bg-elevated/50">
                      <td className="px-4 py-2 text-ink">
                        <a href={q.airtableUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald hover:underline">
                          {q.projectName}
                        </a>
                        {q.blueprint && (
                          <span className="ml-2 inline-flex items-center text-[9px] font-medium uppercase tracking-wider text-violet bg-violet/10 border border-violet/30 px-1.5 py-0.5 rounded">
                            Blueprint
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{q.client ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-muted">
                        <span className={q.earned ? "text-emerald" : "text-amber"}>
                          {q.projectStatus ?? q.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabnum text-ink">{fmtMoney(q.totalCost)}</td>
                      <td className="px-3 py-2 text-right font-mono tabnum text-ink-muted">
                        {(q.rate * 100).toFixed(q.rate * 100 % 1 === 0 ? 0 : 1)}%
                      </td>
                      <td className={`px-4 py-2 text-right font-mono tabnum font-semibold ${q.earned ? "text-emerald" : "text-ink"}`}>
                        {fmtMoney(q.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!isSales && (
        <>
          {/* Stories shipped */}
          <SectionTitle
            title="Stories Shipped"
            aside={shippedIsApproximate ? "YTD/MTD approximated from sprint end dates" : undefined}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Lifetime shipped"
              tone="violet"
              value={shipped.lifetime.toLocaleString()}
              sub={`${fmtMoney(totals.earnedCost)} of scope delivered`}
            />
            <StatCard
              label="YTD shipped"
              tone="emerald"
              value={shipped.ytd.toLocaleString()}
              sub={`In ${currentYear}`}
            />
            <StatCard
              label="MTD shipped"
              tone="sky"
              value={shipped.mtd.toLocaleString()}
              sub={`This ${now.toLocaleString("default", { month: "long" })}`}
            />
            <StatCard
              label="Active in flight"
              value={totals.activeCount.toLocaleString()}
              sub={`${totals.inProgressCount} in progress · ${totals.todoCount} todo · ${totals.qaCount} QA`}
            />
          </div>

          {/* Commission projections (reframed) */}
          <SectionTitle
            title="Commission Projections"
            aside={`${pctLabel} of story cost · projected, not yet paid`}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8">
            <StatCard
              label="Open commission"
              tone="emerald"
              value={fmtMoney(totals.openCommission)}
              sub={`If you ship all ${totals.activeCount} active stories`}
            />
            <StatCard
              label="Earned commission"
              tone="violet"
              value={fmtMoney(totals.earnedCommission)}
              sub={`From ${totals.doneCount} completed stories`}
            />
            <StatCard
              label="Total pipeline potential"
              tone="sky"
              value={fmtMoney(totalPotentialCommission)}
              sub={`Across everything assigned to you`}
            />
          </div>

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
        </>
      )}

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
