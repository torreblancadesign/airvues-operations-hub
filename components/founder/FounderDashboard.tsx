"use client";

// Client-side founder dashboard. All math lives in lib/founder-math.ts.
// Assumptions + current month revenue override are local React state only (v1).
import { useMemo, useState } from "react";
import {
  DEFAULT_ASSUMPTIONS,
  FounderAssumptions,
  fmtPct1,
  fmtUsd,
  project,
} from "@/lib/founder-math";

const SCENARIO_ROWS = [40_000, 50_000, 75_000, 100_000, 115_000, 130_000, 150_000];

type Props = {
  initialMonthlyRevenue: number;
  revenueSource: "mtd" | "default";
};

export function FounderDashboard({ initialMonthlyRevenue, revenueSource }: Props) {
  const [revenue, setRevenue] = useState<number>(initialMonthlyRevenue);
  const [a, setA] = useState<FounderAssumptions>(DEFAULT_ASSUMPTIONS);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const current = useMemo(() => project(revenue, a), [revenue, a]);
  const goal = useMemo(() => project(a.monthlyGoal, a), [a]);
  const gapAnnual = Math.max(0, goal.founderNetAnnual - current.founderNetAnnual);
  const payrollPct = (a.employerPayrollTaxRate * 100).toFixed(2).replace(/\.?0+$/, "");
  const additionalMonthlyRevenue = Math.max(0, a.monthlyGoal - revenue);
  const progressPct = Math.min(100, Math.max(0, current.progressToGoal * 100));
  const closestScenario = SCENARIO_ROWS.reduce((best, r) =>
    Math.abs(r - revenue) < Math.abs(best - revenue) ? r : best,
  SCENARIO_ROWS[0]);

  return (
    <div className="space-y-5">
      {/* 1. Hero — Path to Founder Replacement Income */}
      <section className="bg-surface border border-rule rounded-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="eyebrow">Founder mission</div>
            <h2 className="text-[20px] sm:text-[22px] font-semibold text-ink-strong tracking-tight mt-1">
              Path to Founder Replacement Income
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-ink-faint uppercase tracking-wider">
              Progress
            </div>
            <div className="text-[28px] font-semibold text-emerald tabnum leading-none mt-1">
              {fmtPct1(current.progressToGoal)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Tile label="Current month revenue" value={fmtUsd(revenue)} editable>
            <input
              type="number"
              value={revenue}
              onChange={(e) => setRevenue(Number(e.target.value) || 0)}
              className="mt-1 w-full bg-bg-elevated border border-rule rounded px-2 py-1 text-[13px] text-ink-strong tabnum font-mono focus:outline-none focus:border-emerald"
            />
            <div className="mt-1 text-[10px] text-ink-faint font-mono uppercase tracking-wider">
              {revenueSource === "mtd" ? "Prefilled from paid invoices MTD" : "Default — no invoice data"}
            </div>
          </Tile>
          <Tile label="Monthly goal" value={fmtUsd(a.monthlyGoal)} />
          <Tile
            label="Remaining this month"
            value={fmtUsd(additionalMonthlyRevenue)}
            tone={additionalMonthlyRevenue === 0 ? "emerald" : "ink"}
          />
        </div>

        <div className="relative h-4 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald to-emerald/70 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-ink-muted tabnum">
          <span>$0</span>
          <span>{fmtUsd(a.monthlyGoal)}</span>
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
          eyebrow={`At ${fmtUsd(a.monthlyGoal)}/mo`}
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
                    <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-strong">
                      {fmtUsd(p.founderAnnual)}
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
            <NumInput label="Monthly revenue goal ($)" value={a.monthlyGoal} step={1000}
              onChange={(v) => setA({ ...a, monthlyGoal: v })} />
            <NumInput label="Founder ownership (%)" value={a.founderOwnership * 100} step={1}
              onChange={(v) => setA({ ...a, founderOwnership: v / 100 })} />
            <NumInput label="Engineer commission (%)" value={a.engineerCommission * 100} step={0.5}
              onChange={(v) => setA({ ...a, engineerCommission: v / 100 })} />
            <NumInput label="Shania commission (%)" value={a.shaniaCommission * 100} step={0.5}
              onChange={(v) => setA({ ...a, shaniaCommission: v / 100 })} />
            <NumInput label="Fixed team cost ($/mo)" value={a.fixedTeamCost} step={500}
              onChange={(v) => setA({ ...a, fixedTeamCost: v })} />
            <NumInput label="Software / overhead ($/mo)" value={a.overhead} step={100}
              onChange={(v) => setA({ ...a, overhead: v })} />
            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between pt-2 border-t border-rule">
              <p className="text-[11px] text-ink-faint">
                Changes are local to this session — not saved to Airtable.
              </p>
              <button
                type="button"
                onClick={() => setA(DEFAULT_ASSUMPTIONS)}
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

function ProjectionCard({
  title,
  eyebrow,
  revenue,
  monthlyProfit,
  founderMonthly,
  founderAnnual,
  ownership,
  footnote,
  accent,
}: {
  title: string;
  eyebrow: string;
  revenue: number;
  monthlyProfit: number;
  founderMonthly: number;
  founderAnnual: number;
  ownership: number;
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
        <Row label="Founder monthly earnings" value={fmtUsd(founderMonthly)} strong />
        <Row
          label="Founder annualized earnings"
          value={fmtUsd(founderAnnual)}
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
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <dt className="text-ink-muted">{label}</dt>
      <dd
        className={`tabnum font-mono ${
          accent ? "text-emerald text-[18px] font-semibold" : strong ? "text-ink-strong font-semibold" : "text-ink-strong"
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
