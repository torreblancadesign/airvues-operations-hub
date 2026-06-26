"use client";

import { useMemo, useState } from "react";
import {
  EngineerTier,
  ScalingInputs,
  ScalingOutput,
  ScalingCurvePoint,
  TierHire,
  computeScalingCurve,
  computeScenario,
  proposeRoster,
  DEFAULT_HOURS_PER_MONTH,
} from "@/lib/scaling-math";
import { fmtUsd, fmtPct1 } from "@/lib/founder-math";

const W = 640;
const H = 100;
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 8;
const PAD_B = 18;

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

const fmtPct0 = (n: number) => `${Math.round(n * 100)}%`;

export function ScalingCurves({ inputs }: { inputs: ScalingInputs }) {
  const [maxMult, setMaxMult] = useState(3);
  const [scaleRetainers, setScaleRetainers] = useState(false);
  const [autoHire, setAutoHire] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(
    () => computeScalingCurve(inputs, { steps: 13, maxMultiplier: maxMult, scaleRetainers, autoHire }),
    [inputs, maxMult, scaleRetainers, autoHire],
  );

  const target = inputs.targetMarginPct;
  const monthlyGoal = inputs.desiredMonthlyNet;
  const xMin = points[0]?.projectRevenue ?? 0;
  const xMax = points[points.length - 1]?.projectRevenue ?? 1;
  const xFor = (v: number) => {
    if (xMax === xMin) return PAD_L + (W - PAD_L - PAD_R) / 2;
    return PAD_L + ((v - xMin) / (xMax - xMin)) * (W - PAD_L - PAD_R);
  };

  const hireIdx = points.findIndex((p) => p.demandHours > p.capacityHours);
  const activeIdx = hoverIdx ?? Math.floor(points.length / 2);
  const active = points[activeIdx];

  // Build the proposed roster at the active revenue point.
  const rosterView = useMemo(
    () => buildRosterView(inputs, active, autoHire, scaleRetainers),
    [inputs, active, autoHire, scaleRetainers],
  );

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xPx = PAD_L + xRatio * (W - PAD_L - PAD_R);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(xFor(points[i].projectRevenue) - xPx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };

  return (
    <section className="bg-surface border border-rule rounded-card p-5 sm:p-6 mt-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow">Scaling outlook</div>
          <h3 className="text-[16px] font-semibold text-ink-strong">
            Roster, cost &amp; margin as revenue grows
          </h3>
          <p className="text-[12px] text-ink-muted mt-1">
            Drag the slider or hover the charts to inspect any revenue point. Roster below shows
            current team + auto-proposed hires with full salary + commission breakdown.
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">Max multiplier</span>
            <input
              type="range"
              min={1.5}
              max={6}
              step={0.5}
              value={maxMult}
              onChange={(e) => setMaxMult(Number(e.target.value))}
              className="block w-[160px]"
            />
            <span className="text-[11px] font-mono tabnum text-ink-strong">{maxMult.toFixed(1)}×</span>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-ink-muted cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={scaleRetainers}
              onChange={(e) => setScaleRetainers(e.target.checked)}
              className="accent-violet"
            />
            Scale retainers proportionally
          </label>
          <label className="flex items-center gap-2 text-[11px] text-ink-muted cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={autoHire}
              onChange={(e) => setAutoHire(e.target.checked)}
              className="accent-emerald"
            />
            Auto-hire as we scale
          </label>
        </div>
      </div>

      {/* Revenue scrubber */}
      <div className="mt-4 bg-bg-elevated/40 border border-rule rounded p-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
            Inspecting revenue point
          </span>
          <span className="text-[13px] font-mono tabnum text-ink-strong font-semibold">
            {fmtUsd(active?.projectRevenue ?? 0)}/mo project
            {active && active.retainerRevenue > 0 ? ` + ${fmtUsd(active.retainerRevenue)}/mo retainers` : ""}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, points.length - 1)}
          step={1}
          value={activeIdx}
          onChange={(e) => setHoverIdx(Number(e.target.value))}
          className="block w-full accent-sky"
        />
        <div className="flex justify-between text-[10px] font-mono text-ink-faint mt-1 tabnum">
          <span>{fmtCompact(xMin)}</span>
          <span>{fmtCompact(xMax)}</span>
        </div>
      </div>

      {/* Roster at this revenue */}
      {active && rosterView && (
        <RosterPanel
          rosterView={rosterView}
          point={active}
          autoHire={autoHire}
          target={target}
        />
      )}

      {/* Affordability check */}
      {active && (
        <AffordabilityCheck
          inputs={inputs}
          point={active}
          scaleRetainers={scaleRetainers}
          target={target}
        />
      )}

      {/* Charts: compact 2-col grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <ChartFrame
          title={`Margin %${autoHire ? " (post auto-hire)" : ""}`}
          subtitle={`Target ${fmtPct1(target)}`}
          yFormat={(v) => `${Math.round(v * 100)}%`}
          values={points.map((p) => (autoHire ? p.proposedMarginPct : p.marginPct))}
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          refLine={target}
          tone={(v) => (v >= target ? "#10b981" : v >= target - 0.05 ? "#f59e0b" : "#ef4444")}
          activeIdx={activeIdx}
          onMove={handleMove}
          onLeave={() => {}}
          hireIdx={hireIdx}
        />
        <ChartFrame
          title="Demand vs capacity (hrs/mo)"
          subtitle={autoHire ? `Capacity grows with hires` : `Static capacity`}
          yFormat={(v) => `${Math.round(v)}h`}
          values={points.map((p) => p.demandHours)}
          secondaryValues={points.map((p) =>
            autoHire ? p.proposedFteCapacity * DEFAULT_HOURS_PER_MONTH : p.capacityHours,
          )}
          secondaryTone="#10b981"
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          tone={() => "#0ea5e9"}
          activeIdx={activeIdx}
          onMove={handleMove}
          onLeave={() => {}}
          hireIdx={hireIdx}
        />
        <ChartFrame
          title="Retainer vs project hours"
          subtitle="Violet = retainers · Sky = projects"
          yFormat={(v) => `${Math.round(v)}h`}
          values={points.map((p) => p.projectHours)}
          secondaryValues={points.map((p) => p.retainerHours)}
          secondaryTone="#8b5cf6"
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          tone={() => "#0ea5e9"}
          activeIdx={activeIdx}
          onMove={handleMove}
          onLeave={() => {}}
          hireIdx={hireIdx}
        />
        <ChartFrame
          title="Founder net / mo"
          subtitle={monthlyGoal > 0 ? `Goal ${fmtCompact(monthlyGoal)}` : undefined}
          yFormat={(v) => fmtCompact(v)}
          values={points.map((p) => (autoHire ? p.proposedFounderNetMonthly : p.founderNetMonthly))}
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          refLine={monthlyGoal}
          tone={(v) => (v >= monthlyGoal ? "#10b981" : "#8b5cf6")}
          activeIdx={activeIdx}
          onMove={handleMove}
          onLeave={() => {}}
          hireIdx={hireIdx}
        />
      </div>

      {/* Hiring roadmap */}
      {autoHire && (
        <HiringRoadmap inputs={inputs} points={points} scaleRetainers={scaleRetainers} />
      )}

      {hireIdx >= 0 && (
        <div className="mt-3 text-[11px] text-amber border border-amber/40 bg-amber/10 rounded px-3 py-2">
          Capacity runs out at ~{fmtUsd(points[hireIdx].projectRevenue)}/mo project revenue. Plan a hire before
          then — add ~{Math.ceil(points[hireIdx].shortHours / DEFAULT_HOURS_PER_MONTH)} engineer(s) to clear the shortfall.
        </div>
      )}
    </section>
  );
}

// ===== Roster view =====

type RosterRow = {
  key: string;
  label: string;
  kind: "salaried" | "commission" | "sales" | "other";
  baseCount: number;
  addedCount: number; // proposed delta
  monthlySalary: number;
  commissionLabel: string;
  hoursUsed: number;
  capacityHours: number;
  utilPct: number;
  perHeadSalary: number;
  perHeadCommission: number;
  tierCost: number;
  reason?: string;
};

type RosterView = {
  rows: RosterRow[];
  totals: {
    heads: number;
    addedHeads: number;
    salaries: number;
    commissions: number;
    teamCost: number;
    grossProfit: number;
    marginPct: number;
    founderNet: number;
  };
  newHires: TierHire[];
  baselineOutput: ScalingOutput;
  proposedOutput: ScalingOutput;
};

function buildStepInputs(
  inputs: ScalingInputs,
  point: ScalingCurvePoint,
  scaleRetainers: boolean,
): ScalingInputs {
  const projMult = inputs.monthlyProjectRevenue > 0
    ? point.projectRevenue / inputs.monthlyProjectRevenue
    : 1;
  const retMult = scaleRetainers ? projMult : 1;
  return {
    ...inputs,
    monthlyProjectRevenue: point.projectRevenue,
    retainers: inputs.retainers.map((r) => ({
      ...r,
      monthlyRevenue: r.monthlyRevenue * retMult,
      supportHoursPerMonth: r.supportHoursPerMonth * retMult,
    })),
  };
}

function buildRosterView(
  inputs: ScalingInputs,
  point: ScalingCurvePoint | undefined,
  autoHire: boolean,
  scaleRetainers: boolean,
): RosterView | null {
  if (!point) return null;
  const stepInputs = buildStepInputs(inputs, point, scaleRetainers);
  const baselineOutput = computeScenario(stepInputs);
  const proposed = autoHire ? proposeRoster(stepInputs) : { inputs: stepInputs, output: baselineOutput, proposal: { addSalaried: 0, addCommission: 0, convertCommissionToSalaried: 0, detail: [], tierHires: [] as TierHire[] } };
  const finalInputs = proposed.inputs;
  const out = proposed.output;

  const hireMap = new Map<string, TierHire>();
  for (const h of proposed.proposal.tierHires) {
    const cur = hireMap.get(h.tierId);
    if (cur) cur.delta += h.delta;
    else hireMap.set(h.tierId, { ...h });
  }

  const rows: RosterRow[] = [];

  const addEngTier = (t: EngineerTier, kind: "salaried" | "commission", baseTier: EngineerTier | undefined) => {
    const br = out.tierBreakdown.find((b) => b.id === t.id);
    const cap = t.count * t.hoursPerMonth;
    const used = br ? br.usedHours : 0;
    const commission = br ? br.commission : 0;
    const salary = t.count * t.monthlySalary;
    const baseCount = baseTier?.count ?? 0;
    const addedCount = t.count - baseCount;
    const eligibility: string[] = [];
    if (t.worksOnProjects) eligibility.push("proj");
    if (t.worksOnRetainers) eligibility.push("ret");
    const commLabel = `${fmtPct0(t.commissionRate)} (${eligibility.join("+")})${t.retainerCommission ? "" : " · no ret comm"}`;
    const hire = hireMap.get(t.id);
    rows.push({
      key: `${kind}:${t.id}`,
      label: t.label || (kind === "salaried" ? "Salaried tier" : "Contractor tier"),
      kind,
      baseCount,
      addedCount,
      monthlySalary: t.monthlySalary,
      commissionLabel: commLabel,
      hoursUsed: used,
      capacityHours: cap,
      utilPct: cap > 0 ? used / cap : 0,
      perHeadSalary: t.monthlySalary,
      perHeadCommission: t.count > 0 ? commission / t.count : 0,
      tierCost: salary + commission,
      reason: hire && hire.delta !== 0 ? hire.reason : undefined,
    });
  };

  for (const t of finalInputs.salariedEngineers) {
    const base = inputs.salariedEngineers.find((x) => x.id === t.id);
    addEngTier(t, "salaried", base);
  }
  for (const t of finalInputs.commissionOnlyEngineers) {
    const base = inputs.commissionOnlyEngineers.find((x) => x.id === t.id);
    addEngTier(t, "commission", base);
  }

  // Client Solutions row
  if (finalInputs.clientSolutions.count > 0) {
    const cs = finalInputs.clientSolutions;
    const csCost =
      cs.count * cs.monthlySalary +
      out.commissions.clientSolutions;
    rows.push({
      key: "sales:cs",
      label: "Head of Client Solutions",
      kind: "sales",
      baseCount: cs.count,
      addedCount: 0,
      monthlySalary: cs.monthlySalary,
      commissionLabel: `${fmtPct0(cs.projectCommissionRate)} proj / ${fmtPct0(cs.retainerCommissionRate)} ret`,
      hoursUsed: 0,
      capacityHours: 0,
      utilPct: 0,
      perHeadSalary: cs.monthlySalary,
      perHeadCommission: cs.count > 0 ? out.commissions.clientSolutions / cs.count : 0,
      tierCost: csCost,
    });
  }

  // Other fixed
  if (finalInputs.otherFixed.count > 0) {
    const o = finalInputs.otherFixed;
    rows.push({
      key: "other",
      label: "Other fixed roles",
      kind: "other",
      baseCount: o.count,
      addedCount: 0,
      monthlySalary: o.monthlySalary,
      commissionLabel: "—",
      hoursUsed: 0,
      capacityHours: 0,
      utilPct: 0,
      perHeadSalary: o.monthlySalary,
      perHeadCommission: 0,
      tierCost: o.count * o.monthlySalary,
    });
  }

  const heads = rows.reduce((a, r) => a + r.baseCount + r.addedCount, 0);
  const addedHeads = rows.reduce((a, r) => a + r.addedCount, 0);

  return {
    rows,
    totals: {
      heads,
      addedHeads,
      salaries: out.fixedSalaries,
      commissions: out.commissions.total,
      teamCost: out.totalTeamCost,
      grossProfit: out.grossProfit,
      marginPct: out.netMarginPct,
      founderNet: out.founderNetMonthly,
    },
    newHires: proposed.proposal.tierHires,
    baselineOutput,
    proposedOutput: out,
  };
}

function RosterPanel({
  rosterView,
  point,
  autoHire,
  target,
}: {
  rosterView: RosterView;
  point: ScalingCurvePoint;
  autoHire: boolean;
  target: number;
}) {
  const { rows, totals, newHires } = rosterView;
  const marginTone =
    totals.marginPct >= target ? "text-emerald" : totals.marginPct >= target - 0.05 ? "text-amber" : "text-red";

  return (
    <div className="mt-4 border border-rule rounded-md bg-bg-elevated/30">
      <div className="px-4 py-3 border-b border-rule flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
            Roster at this revenue
          </div>
          <div className="text-[14px] font-semibold text-ink-strong">
            {totals.heads} people on payroll
            {totals.addedHeads > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber/15 text-amber border border-amber/30">
                +{totals.addedHeads} proposed
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-[11px] font-mono">
          <span>Salaries <span className="text-ink-strong tabnum">{fmtUsd(totals.salaries)}</span></span>
          <span>Commissions <span className="text-ink-strong tabnum">{fmtUsd(totals.commissions)}</span></span>
          <span>Team cost <span className="text-ink-strong tabnum">{fmtUsd(totals.teamCost)}</span></span>
          <span>Margin <span className={`tabnum ${marginTone}`}>{fmtPct1(totals.marginPct)}</span></span>
          <span>Your net <span className="text-emerald tabnum">{fmtUsd(totals.founderNet)}</span></span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-wider text-ink-faint border-b border-rule">
              <th className="text-left px-4 py-2 font-normal">Tier</th>
              <th className="text-right px-3 py-2 font-normal">Heads</th>
              <th className="text-right px-3 py-2 font-normal">Salary/mo (each)</th>
              <th className="text-left px-3 py-2 font-normal">Commission</th>
              <th className="text-right px-3 py-2 font-normal">Hours used / cap</th>
              <th className="text-right px-3 py-2 font-normal">Earned/mo (each)</th>
              <th className="text-right px-4 py-2 font-normal">Tier cost/mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const totalCount = r.baseCount + r.addedCount;
              const utilColor =
                r.utilPct >= 1 ? "text-red" : r.utilPct >= 0.85 ? "text-amber" : "text-ink-muted";
              const kindDot =
                r.kind === "salaried"
                  ? "bg-emerald"
                  : r.kind === "commission"
                    ? "bg-sky"
                    : r.kind === "sales"
                      ? "bg-violet"
                      : "bg-ink-faint";
              return (
                <tr key={r.key} className="border-b border-rule/40 last:border-0 hover:bg-bg-elevated/40">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${kindDot}`} />
                      <span className="text-ink-strong">{r.label}</span>
                    </div>
                    {r.reason && (
                      <div className="text-[10px] text-amber mt-0.5 pl-3.5 italic">
                        {r.reason}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabnum font-mono">
                    {totalCount}
                    {r.addedCount > 0 && <span className="text-amber"> (+{r.addedCount})</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabnum font-mono text-ink-strong">
                    {r.monthlySalary > 0 ? fmtUsd(r.monthlySalary) : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-muted text-[11px]">{r.commissionLabel}</td>
                  <td className={`px-3 py-2 text-right tabnum font-mono text-[11px] ${utilColor}`}>
                    {r.capacityHours > 0
                      ? `${Math.round(r.hoursUsed)} / ${Math.round(r.capacityHours)} (${fmtPct0(r.utilPct)})`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabnum font-mono text-[11px]">
                    {r.monthlySalary > 0 ? (
                      <>
                        <span className="text-ink-strong">{fmtUsd(r.perHeadSalary)}</span>
                        {r.perHeadCommission > 0 && (
                          <span className="text-ink-muted"> + {fmtUsd(r.perHeadCommission)}</span>
                        )}
                        <div className="text-emerald">= {fmtUsd(r.perHeadSalary + r.perHeadCommission)}</div>
                      </>
                    ) : (
                      <span className="text-emerald">{fmtUsd(r.perHeadCommission)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabnum font-mono text-ink-strong">
                    {fmtUsd(r.tierCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {autoHire && newHires.filter((h) => h.delta !== 0).length > 0 && (
        <div className="px-4 py-3 border-t border-rule bg-bg-elevated/20">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
            Why these hires at {fmtCompact(point.projectRevenue)}/mo?
          </div>
          <ul className="space-y-1 text-[11px]">
            {newHires
              .filter((h) => h.delta !== 0)
              .map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`font-mono tabnum ${h.delta > 0 ? "text-amber" : "text-ink-muted"}`}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>
                  <span className="text-ink-strong">{h.reason}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== Affordability check =====

function AffordabilityCheck({
  inputs,
  point,
  scaleRetainers,
  target,
}: {
  inputs: ScalingInputs;
  point: ScalingCurvePoint;
  scaleRetainers: boolean;
  target: number;
}) {
  const defaultSalary = inputs.salariedEngineers[0]?.monthlySalary ?? 8000;
  const [salary, setSalary] = useState(defaultSalary);

  const stepInputs = useMemo(
    () => buildStepInputs(inputs, point, scaleRetainers),
    [inputs, point, scaleRetainers],
  );
  const baseline = useMemo(() => computeScenario(stepInputs), [stepInputs]);

  const scenarios = useMemo(() => {
    const addTier = (t: Omit<EngineerTier, "id">): EngineerTier => ({
      ...t,
      id: `__affordability_${Math.random().toString(36).slice(2, 8)}`,
    });
    const trials = [
      {
        label: "Fully salaried (no commission)",
        salary,
        commissionLabel: "0%",
        out: computeScenario({
          ...stepInputs,
          salariedEngineers: [
            ...stepInputs.salariedEngineers,
            addTier({
              label: "What-if hire",
              count: 1,
              monthlySalary: salary,
              commissionRate: 0,
              hoursPerMonth: DEFAULT_HOURS_PER_MONTH,
              worksOnProjects: true,
              worksOnRetainers: true,
              retainerCommission: false,
              manualProjectHours: 0,
              manualRetainerHours: 0,
            }),
          ],
        }),
      },
      {
        label: "Salaried + 15% commission",
        salary,
        commissionLabel: "15%",
        out: computeScenario({
          ...stepInputs,
          salariedEngineers: [
            ...stepInputs.salariedEngineers,
            addTier({
              label: "What-if hire",
              count: 1,
              monthlySalary: salary,
              commissionRate: 0.15,
              hoursPerMonth: DEFAULT_HOURS_PER_MONTH,
              worksOnProjects: true,
              worksOnRetainers: true,
              retainerCommission: false,
              manualProjectHours: 0,
              manualRetainerHours: 0,
            }),
          ],
        }),
      },
      {
        label: "Commission-only contractor (30%)",
        salary: 0,
        commissionLabel: "30%",
        out: computeScenario({
          ...stepInputs,
          commissionOnlyEngineers: [
            ...stepInputs.commissionOnlyEngineers,
            addTier({
              label: "What-if contractor",
              count: 1,
              monthlySalary: 0,
              commissionRate: 0.30,
              hoursPerMonth: DEFAULT_HOURS_PER_MONTH,
              worksOnProjects: true,
              worksOnRetainers: true,
              retainerCommission: false,
              manualProjectHours: 0,
              manualRetainerHours: 0,
            }),
          ],
        }),
      },
    ];
    return trials;
  }, [stepInputs, salary]);

  return (
    <div className="mt-4 border border-rule rounded-md bg-bg-elevated/30 p-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
            Can I afford one more engineer at {fmtCompact(point.projectRevenue)}/mo?
          </div>
          <div className="text-[13px] text-ink-strong">
            Negotiation sandbox — change the salary and see the margin hit.
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px]">
          <span className="text-ink-muted">Salary input:</span>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(Math.max(0, Number(e.target.value)))}
            step={500}
            className="w-28 px-2 py-1 bg-bg-elevated border border-rule rounded text-right tabnum font-mono text-ink-strong"
          />
          <span className="text-ink-faint">/mo</span>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((s, i) => {
          const newMargin = s.out.netMarginPct;
          const ok = newMargin >= target;
          const marginDelta = newMargin - baseline.netMarginPct;
          const netDelta = s.out.founderNetMonthly - baseline.founderNetMonthly;
          const tone = ok ? "border-emerald/40 bg-emerald/5" : newMargin >= target - 0.05 ? "border-amber/40 bg-amber/5" : "border-red/40 bg-red/5";
          const marginTone = ok ? "text-emerald" : newMargin >= target - 0.05 ? "text-amber" : "text-red";
          return (
            <div key={i} className={`rounded border p-3 ${tone}`}>
              <div className="text-[11px] text-ink-strong font-semibold">{s.label}</div>
              <div className="text-[10px] font-mono text-ink-muted mt-0.5">
                {s.salary > 0 ? `${fmtUsd(s.salary)}/mo salary · ` : ""}{s.commissionLabel} commission
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono tabnum">
                <div>
                  <div className="text-ink-faint text-[10px] uppercase">New margin</div>
                  <div className={`${marginTone} font-semibold`}>
                    {fmtPct1(newMargin)} {ok ? "✓" : "✗"}
                  </div>
                  <div className="text-ink-faint text-[10px]">
                    Δ {marginDelta >= 0 ? "+" : ""}{(marginDelta * 100).toFixed(1)} pp
                  </div>
                </div>
                <div>
                  <div className="text-ink-faint text-[10px] uppercase">Your net/mo</div>
                  <div className="text-ink-strong font-semibold">{fmtUsd(s.out.founderNetMonthly)}</div>
                  <div className={`text-[10px] ${netDelta >= 0 ? "text-emerald" : "text-red"}`}>
                    {netDelta >= 0 ? "+" : ""}{fmtUsd(netDelta)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Hiring roadmap (enriched) =====

function HiringRoadmap({
  inputs,
  points,
  scaleRetainers,
}: {
  inputs: ScalingInputs;
  points: ScalingCurvePoint[];
  scaleRetainers: boolean;
}) {
  // Recompute roster view per point so we can show team-size + margin + net deltas.
  const rows = useMemo(() => {
    const acc: {
      revenue: number;
      hires: TierHire[];
      teamBefore: number;
      teamAfter: number;
      marginBefore: number;
      marginAfter: number;
      netBefore: number;
      netAfter: number;
    }[] = [];
    let prevSig = "";
    for (const p of points) {
      const sig = p.proposal.tierHires
        .filter((h) => h.delta !== 0)
        .map((h) => `${h.tierId}:${h.delta}`)
        .sort()
        .join("|");
      if (!sig || sig === prevSig) continue;
      prevSig = sig;
      const stepInputs = buildStepInputs(inputs, p, scaleRetainers);
      const before = computeScenario(stepInputs);
      const after = proposeRoster(stepInputs);
      const teamBefore =
        stepInputs.salariedEngineers.reduce((a, t) => a + t.count, 0) +
        stepInputs.commissionOnlyEngineers.reduce((a, t) => a + t.count, 0);
      const teamAfter =
        after.inputs.salariedEngineers.reduce((a, t) => a + t.count, 0) +
        after.inputs.commissionOnlyEngineers.reduce((a, t) => a + t.count, 0);
      acc.push({
        revenue: p.projectRevenue,
        hires: p.proposal.tierHires.filter((h) => h.delta !== 0),
        teamBefore,
        teamAfter,
        marginBefore: before.netMarginPct,
        marginAfter: after.output.netMarginPct,
        netBefore: before.founderNetMonthly,
        netAfter: after.output.founderNetMonthly,
      });
    }
    return acc;
  }, [inputs, points, scaleRetainers]);

  if (rows.length === 0) return null;

  const tierLookup = new Map<string, EngineerTier>();
  for (const t of inputs.salariedEngineers) tierLookup.set(t.id, t);
  for (const t of inputs.commissionOnlyEngineers) tierLookup.set(t.id, t);

  return (
    <div className="mt-4 border border-rule rounded-md p-3 bg-bg-elevated/30">
      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-2">
        Hiring roadmap as revenue grows
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="text-[12px] border border-rule/50 rounded p-2 bg-bg-elevated/40">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono tabnum text-ink-strong font-semibold">
                {fmtCompact(r.revenue)}/mo
              </span>
              <span className="text-ink-faint">→</span>
              <span className="text-ink-strong">
                {r.hires.map((h, j) => {
                  const t = tierLookup.get(h.tierId);
                  const label = t?.label ?? "tier";
                  const detail = t
                    ? `${fmtUsd(t.monthlySalary)}/mo + ${fmtPct0(t.commissionRate)}`
                    : "";
                  return (
                    <span key={j} className="mr-2">
                      {h.delta > 0 ? `+${h.delta}` : h.delta} {label}
                      {detail && <span className="text-ink-muted"> ({detail})</span>}
                    </span>
                  );
                })}
              </span>
            </div>
            <div className="text-[10px] font-mono text-ink-muted mt-1 tabnum flex gap-4">
              <span>Team: {r.teamBefore} → {r.teamAfter}</span>
              <span>Margin: {fmtPct1(r.marginBefore)} → {fmtPct1(r.marginAfter)}</span>
              <span>Your net: {fmtCompact(r.netBefore)} → {fmtCompact(r.netAfter)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Chart frame (compact) =====

function ChartFrame({
  title,
  subtitle,
  yFormat,
  values,
  secondaryValues,
  secondaryTone,
  xValues,
  xFor,
  refLine,
  tone,
  activeIdx,
  onMove,
  onLeave,
  hireIdx,
}: {
  title: string;
  subtitle?: string;
  yFormat: (v: number) => string;
  values: number[];
  secondaryValues?: number[];
  secondaryTone?: string;
  xValues: number[];
  xFor: (v: number) => number;
  refLine?: number;
  tone: (v: number) => string;
  activeIdx: number | null;
  onMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onLeave: () => void;
  hireIdx: number;
}) {
  const allVals = secondaryValues ? [...values, ...secondaryValues] : values;
  const yMin = Math.min(0, ...allVals, refLine ?? 0);
  const yMax = Math.max(...allVals, refLine ?? 0, 1);
  const range = yMax - yMin || 1;
  const innerH = H - PAD_T - PAD_B;
  const yFor = (v: number) => PAD_T + innerH - ((v - yMin) / range) * innerH;

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(xValues[i]).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(" ");

  const secondaryPath = secondaryValues
    ? secondaryValues
        .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(xValues[i]).toFixed(1)} ${yFor(v).toFixed(1)}`)
        .join(" ")
    : "";

  const lastColor = tone(values[values.length - 1] ?? 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">{title}</span>
        {subtitle && <span className="text-[9px] font-mono text-ink-faint">{subtitle}</span>}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[100px] block bg-bg-elevated/40 border border-rule rounded"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {[0, 0.5, 1].map((t) => {
          const v = yMin + t * range;
          const y = yFor(v);
          return (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(148,163,184,0.12)" />
              <text
                x={PAD_L - 4}
                y={y + 3}
                fontSize={8}
                fill="rgba(148,163,184,0.7)"
                fontFamily="ui-monospace, monospace"
                textAnchor="end"
              >
                {yFormat(v)}
              </text>
            </g>
          );
        })}
        {refLine != null && refLine > yMin && refLine < yMax && (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yFor(refLine)}
            y2={yFor(refLine)}
            stroke="rgba(148,163,184,0.5)"
            strokeDasharray="3 4"
          />
        )}
        {hireIdx >= 0 && xValues[hireIdx] != null && (
          <line
            x1={xFor(xValues[hireIdx])}
            x2={xFor(xValues[hireIdx])}
            y1={PAD_T}
            y2={PAD_T + innerH}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
        {secondaryPath && secondaryTone && (
          <path
            d={secondaryPath}
            fill="none"
            stroke={secondaryTone}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        )}
        <path d={path} fill="none" stroke={lastColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => (
          <circle key={i} cx={xFor(xValues[i])} cy={yFor(v)} r={1.5} fill={tone(v)} />
        ))}
        {activeIdx != null && xValues[activeIdx] != null && (
          <>
            <line
              x1={xFor(xValues[activeIdx])}
              x2={xFor(xValues[activeIdx])}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="rgba(148,163,184,0.6)"
              strokeWidth={1}
            />
            <circle
              cx={xFor(xValues[activeIdx])}
              cy={yFor(values[activeIdx])}
              r={3}
              fill={tone(values[activeIdx])}
            />
          </>
        )}
        <text
          x={PAD_L}
          y={H - 4}
          fontSize={8}
          fill="rgba(148,163,184,0.7)"
          fontFamily="ui-monospace, monospace"
        >
          {fmtCompact(xValues[0] ?? 0)}
        </text>
        <text
          x={W - PAD_R}
          y={H - 4}
          fontSize={8}
          fill="rgba(148,163,184,0.7)"
          fontFamily="ui-monospace, monospace"
          textAnchor="end"
        >
          {fmtCompact(xValues[xValues.length - 1] ?? 0)}
        </text>
      </svg>
    </div>
  );
}
