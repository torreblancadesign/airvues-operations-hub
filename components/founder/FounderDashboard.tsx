"use client";

// Client-side founder dashboard. All math lives in lib/founder-math.ts.
// Seed values come from the signed-in founder's People record:
//   - Retirement Number → monthlyGoal = retirementAnnual / 12 (editable, saves to Airtable)
//   - Ownership Percentage → founderOwnership (read-only)
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_ASSUMPTIONS,
  FounderAssumptions,
  fmtPct1,
  fmtUsd,
  predictMonthsToGoal,
  project,
  requiredRevenueForNetAnnual,
} from "@/lib/founder-math";
import { updateRetirementNumber } from "@/lib/mutations/founder";

const SCENARIO_ROWS = [40_000, 50_000, 75_000, 100_000, 115_000, 130_000, 150_000];

type RevenueTrend = {
  monthlyHistory: number[];
  avgMonthlyGrowth: number;
  latestClosedMonth: number;
};

type Props = {
  initialMonthlyRevenue: number;
  revenueSource: "mtd" | "default";
  personId: string | null;
  retirementAnnual: number | null;
  ownershipPercentage: number | null;
  canEdit: boolean;
  revenueTrend: RevenueTrend;
};

export function FounderDashboard({
  initialMonthlyRevenue,
  revenueSource,
  personId,
  retirementAnnual,
  ownershipPercentage,
  canEdit,
  revenueTrend,
}: Props) {
  const router = useRouter();
  const [revenue, setRevenue] = useState<number>(initialMonthlyRevenue);

  const [retirement, setRetirement] = useState<number | null>(retirementAnnual);
  const ownership = ownershipPercentage ?? DEFAULT_ASSUMPTIONS.founderOwnership;
  const ownershipSource: "airtable" | "default" =
    ownershipPercentage != null ? "airtable" : "default";
  const retirementSource: "airtable" | "default" =
    retirement != null ? "airtable" : "default";

  // Retirement Number from Airtable = the founder's target annual NET take-home.
  // We back-solve the monthly revenue required to produce that take-home, given
  // current ownership / commissions / fixed costs / payroll tax assumptions.
  const DEFAULT_RETIREMENT_ANNUAL = 250_000;
  const effectiveRetirement = retirement ?? DEFAULT_RETIREMENT_ANNUAL;

  // Assumptions: ownership is seeded from Airtable, monthly goal is DERIVED below.
  // The monthlyGoal stored on `a` is recomputed each render so the user can tweak
  // commissions/overhead/payroll-tax and watch the required revenue shift.
  const [aBase, setABase] = useState<FounderAssumptions>({
    ...DEFAULT_ASSUMPTIONS,
    founderOwnership: ownership,
  });

  // Keep ownership in sync if the Airtable value changes mid-session.
  if (aBase.founderOwnership !== ownership) {
    // setState during render is fine here — guarded by an equality check.
    setABase({ ...aBase, founderOwnership: ownership });
  }

  const derivedMonthlyGoal = useMemo(
    () => requiredRevenueForNetAnnual(effectiveRetirement, aBase),
    [effectiveRetirement, aBase],
  );
  const a: FounderAssumptions = { ...aBase, monthlyGoal: derivedMonthlyGoal };
  const goalReachable = Number.isFinite(derivedMonthlyGoal) && derivedMonthlyGoal > 0;


  const [showAssumptions, setShowAssumptions] = useState(false);
  const [editingRetirement, setEditingRetirement] = useState(false);
  const [draftRetirement, setDraftRetirement] = useState<string>(
    retirement != null ? String(retirement) : "",
  );
  const [retirementError, setRetirementError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const current = useMemo(() => project(revenue, a), [revenue, a]);
  const goal = useMemo(() => project(a.monthlyGoal, a), [a]);
  const gapAnnual = Math.max(0, goal.founderNetAnnual - current.founderNetAnnual);
  const payrollPct = (a.employerPayrollTaxRate * 100).toFixed(2).replace(/\.?0+$/, "");
  const additionalMonthlyRevenue = Math.max(0, a.monthlyGoal - revenue);
  const progressPct = Math.min(100, Math.max(0, current.progressToGoal * 100));
  const closestScenario = SCENARIO_ROWS.reduce((best, r) =>
    Math.abs(r - revenue) < Math.abs(best - revenue) ? r : best,
  SCENARIO_ROWS[0]);

  const saveRetirement = (value: number | null) => {
    if (!personId) return;
    setRetirementError(null);
    startSaving(async () => {
      const res = await updateRetirementNumber({ personId, value });
      if ("error" in res) {
        setRetirementError(res.error);
        return;
      }
      setRetirement(value);
      setEditingRetirement(false);
      router.refresh();
    });
  };

  const handleSaveRetirement = () => {
    const trimmed = draftRetirement.trim();
    if (trimmed === "") {
      saveRetirement(null);
      return;
    }
    const parsed = Number(trimmed.replace(/[,$\s]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setRetirementError("Enter a non-negative dollar amount.");
      return;
    }
    saveRetirement(parsed);
  };

  return (
    <div className="space-y-5">
      {/* 1. Hero — Path to Founder Replacement Income */}
      <section className="relative overflow-hidden bg-surface border border-emerald/30 rounded-card p-5 sm:p-7 shadow-[0_0_60px_-20px_rgba(34,211,168,0.25)]">
        {/* ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-emerald/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-emerald/10 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="eyebrow">Founder mission</div>
              <h2 className="text-[22px] sm:text-[26px] font-semibold text-ink-strong tracking-tight mt-1">
                Path to Founder Replacement Income
              </h2>
              <p className="text-[12px] text-ink-muted mt-1">
                {retirementSource === "airtable"
                  ? `Targeting ${fmtUsd(effectiveRetirement)}/yr net take-home`
                  : `Default target · ${fmtUsd(effectiveRetirement)}/yr net take-home`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-mono text-ink-faint uppercase tracking-wider">
                Progress to goal
              </div>
              <div className="text-[52px] sm:text-[64px] font-semibold text-emerald tabnum leading-none mt-1 drop-shadow-[0_0_24px_rgba(34,211,168,0.4)]">
                {fmtPct1(current.progressToGoal)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="relative h-3 bg-bg-elevated rounded-full overflow-hidden border border-rule/60">
              <div
                className="h-full bg-gradient-to-r from-emerald via-emerald to-emerald/60 rounded-full transition-all duration-700 shadow-[0_0_18px_rgba(34,211,168,0.6)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-ink-faint tabnum uppercase tracking-wider">
              <span>$0</span>
              <span>{goalReachable ? fmtUsd(a.monthlyGoal) : "—"} / mo goal</span>
            </div>
          </div>

          {/* Headline KPI strip */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <HeroStat
              label="Current yearly earnings"
              value={fmtUsd(current.founderNetAnnual)}
              hint="Annualized net take-home at today's pace"
              tone="emerald"
            />
            <HeroStat
              label="Predicted months to goal"
              value={
                monthsPrediction.kind === "at-goal"
                  ? "At goal"
                  : monthsPrediction.kind === "flat"
                    ? "—"
                    : `~${monthsPrediction.value} mo`
              }
              hint={
                monthsPrediction.kind === "months"
                  ? `Based on +${fmtUsd(revenueTrend.avgMonthlyGrowth)}/mo avg growth (last ${revenueTrend.monthlyHistory.length} mo)`
                  : monthsPrediction.kind === "at-goal"
                    ? "Current run-rate already meets the goal"
                    : revenueTrend.monthlyHistory.length < 2
                      ? "Need at least 2 closed months of data"
                      : "Trend flat or negative — no predicted date"
              }
              tone={monthsPrediction.kind === "at-goal" ? "emerald" : "ink"}
            />
            <HeroStat
              label="Monthly revenue needed"
              value={goalReachable ? fmtUsd(a.monthlyGoal) : "—"}
              hint={
                additionalMonthlyRevenue === 0
                  ? "Goal cleared this month"
                  : `${fmtUsd(additionalMonthlyRevenue)} remaining this month`
              }
            />
          </div>

          {/* Footer row — quieter edit affordances */}
          <div className="mt-5 pt-4 border-t border-rule/60 flex items-end gap-4 flex-wrap">
            <label className="block">
              <span className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">
                Current month revenue
              </span>
              <input
                type="number"
                value={revenue}
                onChange={(e) => setRevenue(Number(e.target.value) || 0)}
                className="mt-1 w-[180px] bg-bg-elevated border border-rule rounded px-2 py-1 text-[13px] text-ink-strong tabnum font-mono focus:outline-none focus:border-emerald"
              />
              <div className="mt-1 text-[10px] text-ink-faint font-mono uppercase tracking-wider">
                {revenueSource === "mtd" ? "Prefilled from paid invoices MTD" : "Default — no invoice data"}
              </div>
            </label>
            {canEdit && !editingRetirement && (
              <button
                type="button"
                onClick={() => {
                  setDraftRetirement(retirement != null ? String(retirement) : "");
                  setRetirementError(null);
                  setEditingRetirement(true);
                }}
                className="text-[11px] font-mono uppercase tracking-wider text-emerald hover:underline ml-auto"
              >
                Edit retirement #
              </button>
            )}
          </div>

          {editingRetirement && (
            <div className="mt-4 bg-bg-elevated/50 border border-emerald/40 rounded-md p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald mb-2">
                Edit annual retirement number
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint text-[14px] font-mono">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={draftRetirement}
                    onChange={(e) => setDraftRetirement(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRetirement();
                      if (e.key === "Escape") setEditingRetirement(false);
                    }}
                    placeholder="1380000"
                    className="pl-7 pr-3 py-1.5 text-[14px] font-mono tabnum bg-bg border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none w-[200px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveRetirement}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-[12px] font-medium bg-emerald text-bg rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingRetirement(false); setRetirementError(null); }}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong"
                >
                  Cancel
                </button>
                {retirement != null && (
                  <button
                    type="button"
                    onClick={() => saveRetirement(null)}
                    disabled={isSaving}
                    className="ml-auto text-[11px] text-red hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {retirementError && <div className="text-[11px] text-red mt-2">{retirementError}</div>}
              <div className="text-[11px] text-ink-faint mt-2">
                Target annual NET take-home (after employer payroll tax). We back-solve the monthly revenue needed to reach it. Saves to your People record as Retirement Number.
              </div>
            </div>
          )}

          {!goalReachable && (
            <div className="mt-3 text-[11px] text-amber">
              Goal unreachable with current ownership / commissions — adjust assumptions below.
            </div>
          )}
        </div>
      </section>

      {/* 2 + 3 side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ProjectionCard
          title="Founder earnings — current pace"
          eyebrow="At today's run-rate"
          revenue={current.revenue}
          monthlyProfit={current.monthlyProfit}
          founderMonthly={current.founderMonthly}
          founderAnnual={current.founderAnnual}
          payrollTaxMonthly={current.payrollTaxMonthly}
          founderNetMonthly={current.founderNetMonthly}
          founderNetAnnual={current.founderNetAnnual}
          ownership={a.founderOwnership}
          payrollPct={payrollPct}
          footnote={`Net of employer payroll tax (~${payrollPct}%). Based on the current monthly revenue pace, your take-home–equivalent annualized earnings are approximately ${fmtUsd(current.founderNetAnnual)}.`}
        />
        <ProjectionCard
          title="Founder earnings — at goal"
          eyebrow={goalReachable ? `At ${fmtUsd(a.monthlyGoal)}/mo · your retirement #` : "Unreachable at current assumptions"}
          revenue={goal.revenue}
          monthlyProfit={goal.monthlyProfit}
          founderMonthly={goal.founderMonthly}
          founderAnnual={goal.founderAnnual}
          payrollTaxMonthly={goal.payrollTaxMonthly}
          founderNetMonthly={goal.founderNetMonthly}
          founderNetAnnual={goal.founderNetAnnual}
          ownership={a.founderOwnership}
          payrollPct={payrollPct}
          footnote={`Net of employer payroll tax (Social Security 6.2% + Medicare 1.45%, modeled at ${payrollPct}%). Still before personal income taxes and assumes the comp structure is unchanged.`}
          accent
        />

      </div>

      {/* 4. Gap analysis */}
      <section className="bg-surface border border-rule rounded-card p-5 sm:p-6">
        <div className="eyebrow mb-1">Gap analysis</div>
        <h3 className="text-[16px] font-semibold text-ink-strong mb-4">
          Gap to Replacement Income
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Current annualized (net)" value={fmtUsd(current.founderNetAnnual)} />
          <Tile label="Goal annualized (net)" value={fmtUsd(goal.founderNetAnnual)} tone="emerald" />
          <Tile label="Annual gap (net)" value={fmtUsd(gapAnnual)} tone={gapAnnual === 0 ? "emerald" : "amber"} />
          <Tile
            label="Additional revenue / mo needed"
            value={fmtUsd(additionalMonthlyRevenue)}
            tone={additionalMonthlyRevenue === 0 ? "emerald" : "ink"}
          />
        </div>
        <p className="mt-3 text-[11px] text-ink-muted leading-snug">
          Net values deduct the ~{payrollPct}% employer payroll tax Airvues owes on founder compensation.
        </p>

      </section>

      {/* 5. Scenario table */}
      <section className="bg-surface border border-rule rounded-card p-5 sm:p-6">
        <div className="eyebrow mb-1">Scenarios</div>
        <h3 className="text-[16px] font-semibold text-ink-strong mb-4">
          Revenue → founder earnings
        </h3>
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] font-mono text-ink-faint uppercase tracking-wider border-b border-rule">
                <th className="py-2 px-5 sm:px-6">Monthly Revenue</th>
                <th className="py-2 px-3 text-right">Monthly Profit</th>
                <th className="py-2 px-3 text-right">Founder Monthly (gross)</th>
                <th className="py-2 px-3 text-right">Founder Annual (gross)</th>
                <th className="py-2 px-3 text-right">Founder Net Annual</th>
                <th className="py-2 px-5 sm:px-6 text-right">Progress to {fmtUsd(a.monthlyGoal)}</th>
              </tr>

            </thead>
            <tbody>
              {SCENARIO_ROWS.map((r) => {
                const p = project(r, a);
                const highlight = r === closestScenario;
                return (
                  <tr
                    key={r}
                    className={`border-b border-rule/60 last:border-0 ${
                      highlight ? "bg-emerald/5" : ""
                    }`}
                  >
                    <td className="py-2.5 px-5 sm:px-6 tabnum font-mono text-ink-strong">
                      {fmtUsd(r)}
                      {highlight && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald font-mono">
                          closest
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-muted">
                      {fmtUsd(p.monthlyProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-muted">
                      {fmtUsd(p.founderMonthly)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-muted">
                      {fmtUsd(p.founderAnnual)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-strong">
                      {fmtUsd(p.founderNetAnnual)}
                    </td>
                    <td className="py-2.5 px-5 sm:px-6 text-right tabnum font-mono text-ink-muted">
                      {fmtPct1(p.progressToGoal)}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Assumptions */}
      <section className="bg-surface border border-rule rounded-card p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setShowAssumptions((v) => !v)}
          className="w-full flex items-center justify-between gap-4 text-left"
        >
          <div>
            <div className="eyebrow">Model inputs</div>
            <h3 className="text-[16px] font-semibold text-ink-strong">
              Assumptions
            </h3>
          </div>
          <span className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
            {showAssumptions ? "Hide" : "Edit"}
          </span>
        </button>
        {showAssumptions && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ReadOnlyField
              label="Monthly revenue needed ($)"
              value={goalReachable ? fmtUsd(a.monthlyGoal) : "—"}
              source={`Derived to net ${fmtUsd(effectiveRetirement)}/yr`}
            />
            <ReadOnlyField
              label="Founder ownership (%)"
              value={fmtPct1(a.founderOwnership)}
              source={ownershipSource === "airtable" ? "From Airtable Ownership %" : "Default — set Ownership % in Airtable"}
            />
            <NumInput label="Engineer commission (%)" value={a.engineerCommission * 100} step={0.5}
              onChange={(v) => setABase({ ...aBase, engineerCommission: v / 100 })} />
            <NumInput label="Shania commission (%)" value={a.shaniaCommission * 100} step={0.5}
              onChange={(v) => setABase({ ...aBase, shaniaCommission: v / 100 })} />
            <NumInput label="Fixed team cost ($/mo)" value={a.fixedTeamCost} step={500}
              onChange={(v) => setABase({ ...aBase, fixedTeamCost: v })} />
            <NumInput label="Software / overhead ($/mo)" value={a.overhead} step={100}
              onChange={(v) => setABase({ ...aBase, overhead: v })} />
            <NumInput label="Employer payroll tax (%)" value={a.employerPayrollTaxRate * 100} step={0.05}
              onChange={(v) => setABase({ ...aBase, employerPayrollTaxRate: v / 100 })} />
            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between pt-2 border-t border-rule">
              <p className="text-[11px] text-ink-faint">
                Retirement # + ownership come from Airtable. Monthly revenue needed is back-solved.
              </p>
              <button
                type="button"
                onClick={() => setABase({
                  ...DEFAULT_ASSUMPTIONS,
                  founderOwnership: aBase.founderOwnership,
                })}
                className="text-[11px] font-mono uppercase tracking-wider text-ink-muted hover:text-ink-strong transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "ink",
  editable,
  children,
}: {
  label: string;
  value: string;
  tone?: "ink" | "emerald" | "amber";
  editable?: boolean;
  children?: React.ReactNode;
}) {
  const valueClass =
    tone === "emerald" ? "text-emerald" : tone === "amber" ? "text-amber" : "text-ink-strong";
  return (
    <div className="bg-bg-elevated/50 border border-rule rounded-md p-3">
      <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">{label}</div>
      {!editable && (
        <div className={`mt-1 text-[20px] font-semibold tabnum font-mono ${valueClass}`}>
          {value}
        </div>
      )}
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="bg-bg-elevated/30 border border-rule rounded px-2 py-1.5">
      <span className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">{label}</span>
      <div className="mt-1 text-[13px] text-ink-strong tabnum font-mono">{value}</div>
      <div className="mt-0.5 text-[10px] text-ink-faint">{source}</div>
    </div>
  );
}

function ProjectionCard({
  title,
  eyebrow,
  revenue,
  monthlyProfit,
  founderMonthly,
  founderAnnual,
  payrollTaxMonthly,
  founderNetMonthly,
  founderNetAnnual,
  ownership,
  payrollPct,
  footnote,
  accent,
}: {
  title: string;
  eyebrow: string;
  revenue: number;
  monthlyProfit: number;
  founderMonthly: number;
  founderAnnual: number;
  payrollTaxMonthly: number;
  founderNetMonthly: number;
  founderNetAnnual: number;
  ownership: number;
  payrollPct: string;
  footnote: string;
  accent?: boolean;
}) {
  return (
    <section
      className={`bg-surface border rounded-card p-5 sm:p-6 ${
        accent ? "border-emerald/40 shadow-[0_0_24px_-16px_rgba(34,211,168,0.4)]" : "border-rule"
      }`}
    >
      <div className="eyebrow mb-1">{eyebrow}</div>
      <h3 className="text-[16px] font-semibold text-ink-strong mb-4">{title}</h3>
      <dl className="space-y-2 text-[13px]">
        <Row label="Monthly revenue" value={fmtUsd(revenue)} />
        <Row label="Estimated monthly profit" value={fmtUsd(monthlyProfit)} />
        <Row label="Founder ownership" value={fmtPct1(ownership)} />
        <Row label="Founder monthly (gross)" value={fmtUsd(founderMonthly)} />
        <Row label="Founder annualized (gross)" value={fmtUsd(founderAnnual)} />
        <Row
          label={`Employer payroll tax (${payrollPct}%)`}
          value={`−${fmtUsd(payrollTaxMonthly)} / mo`}
          muted
        />
        <Row label="Founder net monthly" value={fmtUsd(founderNetMonthly)} strong />
        <Row
          label="Founder net annualized"
          value={fmtUsd(founderNetAnnual)}
          strong
          accent={accent}
        />
      </dl>
      <p className="mt-4 text-[11px] text-ink-muted leading-snug">{footnote}</p>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <dt className={muted ? "text-ink-faint" : "text-ink-muted"}>{label}</dt>
      <dd
        className={`tabnum font-mono ${
          accent ? "text-emerald text-[18px] font-semibold" : strong ? "text-ink-strong font-semibold" : muted ? "text-ink-muted" : "text-ink-strong"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function NumInput({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full bg-bg-elevated border border-rule rounded px-2 py-1.5 text-[13px] text-ink-strong tabnum font-mono focus:outline-none focus:border-emerald"
      />
    </label>
  );
}
