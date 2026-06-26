"use client";

import { useMemo, useState } from "react";
import {
  CLIENT_SOLUTIONS_COMMISSION,
  DEFAULT_HOURS_PER_MONTH,
  EngineerTier,
  HiringSignal,
  Retainer,
  RetainerCoverage,
  ScalingInputs,
  ScalingOutput,
  TierBreakdown,
  computeScenario,
  defaultInputs,
  makeRetainer,
  makeTier,
  migrateInputs,
} from "@/lib/scaling-math";
import { fmtPct1, fmtUsd } from "@/lib/founder-math";
import { useLocalStorageJSON } from "@/lib/use-local-storage";

type SavedScenario = { id: string; name: string; inputs: ScalingInputs };

const STORAGE_KEY = "founder:scaling-scenarios:v2";
const MAX_SCENARIOS = 4;

type Props = {
  monthlyRevenue: number;
  founderOwnership: number;
  desiredMonthlyNet: number;
  payrollTaxRate: number;
};

export function TeamScalingSimulator({
  monthlyRevenue,
  founderOwnership,
  desiredMonthlyNet,
  payrollTaxRate,
}: Props) {
  const seed = useMemo(
    () =>
      defaultInputs({
        monthlyRevenue,
        founderOwnership,
        desiredMonthlyNet,
        payrollTaxRate,
      }),
    [monthlyRevenue, founderOwnership, desiredMonthlyNet, payrollTaxRate],
  );

  const [inputs, setInputs] = useState<ScalingInputs>(seed);
  const [rawScenarios, setScenarios] = useLocalStorageJSON<SavedScenario[]>(STORAGE_KEY, []);
  const scenarios = useMemo(
    () =>
      rawScenarios
        .map((s) => {
          const migrated = migrateInputs(s.inputs);
          return migrated ? { ...s, inputs: migrated } : null;
        })
        .filter((x): x is SavedScenario => !!x),
    [rawScenarios],
  );
  const [scenarioName, setScenarioName] = useState("");

  const out = useMemo(() => computeScenario(inputs), [inputs]);

  const update = <K extends keyof ScalingInputs>(k: K, v: ScalingInputs[K]) =>
    setInputs((s) => ({ ...s, [k]: v }));

  const updateTier = (
    field: "salariedEngineers" | "commissionOnlyEngineers",
    id: string,
    patch: Partial<EngineerTier>,
  ) =>
    setInputs((s) => ({
      ...s,
      [field]: s[field].map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));

  const addTier = (field: "salariedEngineers" | "commissionOnlyEngineers") =>
    setInputs((s) => ({
      ...s,
      [field]: [
        ...s[field],
        makeTier({ kind: field === "salariedEngineers" ? "salaried" : "commission" }),
      ],
    }));

  const removeTier = (field: "salariedEngineers" | "commissionOnlyEngineers", id: string) =>
    setInputs((s) => ({ ...s, [field]: s[field].filter((t) => t.id !== id) }));

  const updateClientSolutions = (patch: Partial<ScalingInputs["clientSolutions"]>) =>
    setInputs((s) => ({ ...s, clientSolutions: { ...s.clientSolutions, ...patch } }));

  const updateRetainer = (id: string, patch: Partial<Retainer>) =>
    setInputs((s) => ({
      ...s,
      retainers: s.retainers.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  const addRetainer = () =>
    setInputs((s) => ({ ...s, retainers: [...s.retainers, makeRetainer()] }));
  const removeRetainer = (id: string) =>
    setInputs((s) => ({ ...s, retainers: s.retainers.filter((r) => r.id !== id) }));

  const saveScenario = () => {
    const name = scenarioName.trim() || `Scenario ${scenarios.length + 1}`;
    const id = `${Date.now()}`;
    setScenarios((prev) => [...prev, { id, name, inputs }].slice(-MAX_SCENARIOS));
    setScenarioName("");
  };

  const loadScenario = (id: string) => {
    const s = scenarios.find((x) => x.id === id);
    if (s) setInputs(s.inputs);
  };

  const deleteScenario = (id: string) =>
    setScenarios((prev) => prev.filter((s) => s.id !== id));

  const resetInputs = () => setInputs(seed);

  return (
    <section className="bg-surface border border-rule rounded-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow">Strategic planning</div>
          <h3 className="text-[16px] font-semibold text-ink-strong">
            Team Scaling &amp; Margin Simulator
          </h3>
          <p className="text-[12px] text-ink-muted mt-1">
            Model team tiers, capacity, and revenue mix to see margin, founder take-home, and when
            to hire next. Stays in your browser — no Airtable writes.
          </p>
        </div>
        <button
          type="button"
          onClick={resetInputs}
          className="text-[11px] font-mono uppercase tracking-wider text-ink-muted hover:text-ink-strong"
        >
          Reset to seed
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5">
        {/* Inputs */}
        <div className="space-y-5">
          {/* Revenue */}
          <Card title="Projected revenue">
            <div className="grid grid-cols-3 gap-3">
              <Num label="Project rev ($/mo)" value={inputs.monthlyProjectRevenue} step={1000}
                onChange={(v) => update("monthlyProjectRevenue", v)} />
              <Num label="Retainer rev ($/mo)" value={inputs.monthlyRetainerRevenue} step={500}
                onChange={(v) => update("monthlyRetainerRevenue", v)} />
              <Num label="Billing rate ($/hr)" value={inputs.revenueHourlyRate} step={5}
                onChange={(v) => update("revenueHourlyRate", v)} />
            </div>
            <div className="mt-2 text-[11px] font-mono text-ink-faint uppercase tracking-wider">
              Total: <span className="tabnum text-ink-strong">{fmtUsd(out.totalRevenue)}/mo</span>
              {" · "}Needs{" "}
              <span className="tabnum text-ink-strong">{Math.round(out.projectHoursNeeded)} hrs/mo</span>{" "}
              of project work
            </div>
          </Card>

          {/* Salaried tiers */}
          <Card
            title="Salaried engineers"
            action={
              <button
                type="button"
                onClick={() => addTier("salariedEngineers")}
                className="text-[11px] font-mono uppercase tracking-wider text-emerald hover:opacity-80"
              >
                + Add tier
              </button>
            }
          >
            {inputs.salariedEngineers.length === 0 && (
              <p className="text-[11px] text-ink-faint">No salaried engineers.</p>
            )}
            {inputs.salariedEngineers.map((t) => (
              <TierEditor
                key={t.id}
                tier={t}
                showSalary
                onChange={(p) => updateTier("salariedEngineers", t.id, p)}
                onRemove={() => removeTier("salariedEngineers", t.id)}
              />
            ))}
          </Card>

          {/* Commission tiers */}
          <Card
            title="Commission-only engineers"
            action={
              <button
                type="button"
                onClick={() => addTier("commissionOnlyEngineers")}
                className="text-[11px] font-mono uppercase tracking-wider text-emerald hover:opacity-80"
              >
                + Add tier
              </button>
            }
          >
            {inputs.commissionOnlyEngineers.length === 0 && (
              <p className="text-[11px] text-ink-faint">No commission-only engineers.</p>
            )}
            {inputs.commissionOnlyEngineers.map((t) => (
              <TierEditor
                key={t.id}
                tier={t}
                onChange={(p) => updateTier("commissionOnlyEngineers", t.id, p)}
                onRemove={() => removeTier("commissionOnlyEngineers", t.id)}
              />
            ))}
          </Card>

          {/* Sales + other */}
          <Card title="Sales & other fixed">
            <div className="py-2 border-b border-rule/40">
              <div className="text-[12px] text-ink-strong font-medium mb-2">
                Head of Client Solutions
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Num label="Count" value={inputs.clientSolutions.count} step={1}
                  onChange={(v) => updateClientSolutions({ count: v })} />
                <Num label="Salary ($/mo)" value={inputs.clientSolutions.monthlySalary} step={500}
                  onChange={(v) => updateClientSolutions({ monthlySalary: v })} />
                <Num label="Commission (%)" value={inputs.clientSolutions.commissionRate * 100} step={0.5}
                  onChange={(v) => updateClientSolutions({ commissionRate: v / 100 })} />
              </div>
              <div className="mt-1.5 text-[10px] text-ink-faint">
                Default {fmtPct1(CLIENT_SOLUTIONS_COMMISSION)} — applies once to all project revenue.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Num
                label="Other fixed roles (count)"
                value={inputs.otherFixed.count}
                step={1}
                onChange={(v) => update("otherFixed", { ...inputs.otherFixed, count: v })}
              />
              <Num
                label="Avg salary ($/mo)"
                value={inputs.otherFixed.monthlySalary}
                step={500}
                onChange={(v) =>
                  update("otherFixed", { ...inputs.otherFixed, monthlySalary: v })
                }
              />
            </div>
          </Card>

          {/* Strategy */}
          <Card title="Cost & strategy">
            <div className="grid grid-cols-2 gap-3">
              <Num label="Overhead ($/mo)" value={inputs.overhead} step={100}
                onChange={(v) => update("overhead", v)} />
              <Num label="Target margin (%)" value={inputs.targetMarginPct * 100} step={1}
                onChange={(v) => update("targetMarginPct", v / 100)} />
              <Num label="Founder ownership (%)" value={inputs.founderOwnership * 100} step={1}
                onChange={(v) => update("founderOwnership", v / 100)} />
              <Num label="Desired founder net ($/mo)" value={inputs.desiredMonthlyNet} step={1000}
                onChange={(v) => update("desiredMonthlyNet", v)} />
            </div>
          </Card>
        </div>

        {/* Readout */}
        <div className="space-y-5">
          <Readout out={out} target={inputs.targetMarginPct} />
          <CapacityPanel out={out} />
        </div>
      </div>

      {/* Scenarios */}
      <div className="mt-6 pt-5 border-t border-rule">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="eyebrow">Compare</div>
            <h4 className="text-[14px] font-semibold text-ink-strong">Saved scenarios</h4>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Scenario name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="bg-bg-elevated border border-rule rounded px-2 py-1.5 text-[12px] text-ink-strong w-[180px] focus:outline-none focus:border-emerald"
            />
            <button
              type="button"
              onClick={saveScenario}
              disabled={scenarios.length >= MAX_SCENARIOS}
              className="px-3 py-1.5 text-[12px] font-medium bg-emerald text-bg rounded hover:opacity-90 disabled:opacity-40"
              title={scenarios.length >= MAX_SCENARIOS ? `Max ${MAX_SCENARIOS} scenarios` : ""}
            >
              Save current
            </button>
          </div>
        </div>

        {scenarios.length === 0 ? (
          <p className="mt-3 text-[12px] text-ink-faint">
            No saved scenarios yet. Save the current inputs to start comparing.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto -mx-5 sm:-mx-6">
            <table className="w-full text-[13px] min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] font-mono text-ink-faint uppercase tracking-wider border-b border-rule">
                  <th className="py-2 px-5 sm:px-6">Scenario</th>
                  <th className="py-2 px-3 text-right">Revenue</th>
                  <th className="py-2 px-3 text-right">Team cost</th>
                  <th className="py-2 px-3 text-right">Margin</th>
                  <th className="py-2 px-3 text-right">Founder net/mo</th>
                  <th className="py-2 px-3 text-right">Founder net/yr</th>
                  <th className="py-2 px-3 text-right">Hiring</th>
                  <th className="py-2 px-5 sm:px-6"></th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => {
                  const o = computeScenario(s.inputs);
                  return (
                    <tr key={s.id} className="border-b border-rule/60 last:border-0">
                      <td className="py-2.5 px-5 sm:px-6 text-ink-strong">{s.name}</td>
                      <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-muted">{fmtUsd(o.totalRevenue)}</td>
                      <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-muted">{fmtUsd(o.totalTeamCost)}</td>
                      <td className={`py-2.5 px-3 text-right tabnum font-mono ${marginColor(o.netMarginPct, s.inputs.targetMarginPct)}`}>{fmtPct1(o.netMarginPct)}</td>
                      <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-strong">{fmtUsd(o.founderNetMonthly)}</td>
                      <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-strong">{fmtUsd(o.founderNetAnnual)}</td>
                      <td className={`py-2.5 px-3 text-right text-[11px] ${hiringTextColor(o.hiring)}`}>
                        {hiringChip(o.hiring)}
                      </td>
                      <td className="py-2.5 px-5 sm:px-6 text-right">
                        <button onClick={() => loadScenario(s.id)} className="text-[11px] text-emerald hover:underline mr-3">Load</button>
                        <button onClick={() => deleteScenario(s.id)} className="text-[11px] text-red hover:underline">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function marginColor(margin: number, target: number): string {
  if (margin >= target) return "text-emerald";
  if (margin >= target - 0.05) return "text-amber";
  return "text-red";
}

function hiringTextColor(h: HiringSignal): string {
  return h.kind === "hire" ? "text-red" : h.kind === "warn" ? "text-amber" : "text-ink-muted";
}

function hiringChip(h: HiringSignal): string {
  if (h.kind === "hire") return `Hire +${h.salariedNeeded}`;
  if (h.kind === "warn") return "Hot";
  return "Healthy";
}

function Readout({ out, target }: { out: ScalingOutput; target: number }) {
  const verdictLabel =
    out.verdict === "healthy" ? "Healthy" : out.verdict === "tight" ? "Tight" : "Below target";
  const verdictClass =
    out.verdict === "healthy"
      ? "border-emerald/40 bg-emerald/10 text-emerald"
      : out.verdict === "tight"
        ? "border-amber/40 bg-amber/10 text-amber"
        : "border-red/40 bg-red/10 text-red";

  return (
    <div className="bg-bg-elevated/40 border border-rule rounded-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="eyebrow">Live readout</div>
        <span className={`text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${verdictClass}`}>
          {verdictLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Total revenue" value={fmtUsd(out.totalRevenue)} />
        <Kpi label="Team cost" value={fmtUsd(out.totalTeamCost)} />
        <Kpi label="Fixed salaries" value={fmtUsd(out.fixedSalaries)} muted />
        <Kpi label="Commissions" value={fmtUsd(out.commissions.total)} muted />
        <Kpi label="Gross profit" value={fmtUsd(out.grossProfit)} tone={out.grossProfit >= 0 ? "ink" : "red"} />
        <Kpi
          label={`Margin (target ${fmtPct1(target)})`}
          value={fmtPct1(out.netMarginPct)}
          tone={out.verdict === "healthy" ? "emerald" : out.verdict === "tight" ? "amber" : "red"}
        />
      </div>

      <div className="pt-3 border-t border-rule/60 grid grid-cols-2 gap-2">
        <Kpi label="Founder net / mo" value={fmtUsd(out.founderNetMonthly)} tone="emerald" />
        <Kpi label="Founder net / yr" value={fmtUsd(out.founderNetAnnual)} tone="emerald" />
        <Kpi
          label="Gap vs desired / mo"
          value={fmtUsd(out.gapToDesiredMonthly)}
          tone={out.gapToDesiredMonthly === 0 ? "emerald" : "amber"}
        />
        <Kpi
          label="Headroom revenue"
          value={
            !Number.isFinite(out.headroomRevenue)
              ? "Unbounded"
              : out.headroomRevenue > 0
                ? `+${fmtUsd(out.headroomRevenue)}/mo`
                : "At limit"
          }
          muted
        />
      </div>

      <div className="pt-3 border-t border-rule/60 text-[11px] text-ink-faint leading-snug">
        Commission split (capacity-driven, never stacked):{" "}
        <span className="tabnum">{fmtUsd(out.commissions.salariedEngineers)}</span> salaried ·{" "}
        <span className="tabnum">{fmtUsd(out.commissions.commissionOnlyEngineers)}</span> commission-only ·{" "}
        <span className="tabnum">{fmtUsd(out.commissions.clientSolutions)}</span> client solutions
      </div>
    </div>
  );
}

function CapacityPanel({ out }: { out: ScalingOutput }) {
  const banner =
    out.hiring.kind === "hire"
      ? "border-red/40 bg-red/10 text-red"
      : out.hiring.kind === "warn"
        ? "border-amber/40 bg-amber/10 text-amber"
        : "border-emerald/40 bg-emerald/10 text-emerald";

  return (
    <div className="bg-bg-elevated/40 border border-rule rounded-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="eyebrow">Capacity & hiring</div>
        <div className="text-[11px] font-mono tabnum text-ink-faint">
          {Math.round(out.projectHoursNeeded)} hrs needed /{" "}
          {Math.round(out.salariedCapacityHours + out.commissionCapacityHours)} hrs available
        </div>
      </div>

      <div className={`text-[12px] px-3 py-2 rounded border ${banner}`}>{out.hiring.message}</div>

      <div className="space-y-2">
        {out.tierBreakdown.length === 0 && (
          <div className="text-[11px] text-ink-faint">No engineer tiers configured.</div>
        )}
        {out.tierBreakdown.map((t) => (
          <TierBar key={t.id} t={t} />
        ))}
      </div>

      {out.unmetHours > 0.5 && (
        <div className="pt-2 border-t border-rule/60 text-[11px] text-ink-faint">
          Unmet demand:{" "}
          <span className="tabnum text-red">{Math.round(out.unmetHours)} hrs/mo</span>{" "}
          (~{Math.ceil(out.unmetHours / DEFAULT_HOURS_PER_MONTH)} engineer
          {Math.ceil(out.unmetHours / DEFAULT_HOURS_PER_MONTH) === 1 ? "" : "s"}).
        </div>
      )}
    </div>
  );
}

function TierBar({ t }: { t: TierBreakdown }) {
  const pct = Math.min(1.2, t.utilizationPct);
  const pctDisplay = Math.round(t.utilizationPct * 100);
  const tone =
    t.utilizationPct > 1
      ? "bg-red"
      : t.utilizationPct > 0.85
        ? "bg-amber"
        : t.utilizationPct > 0
          ? "bg-emerald"
          : "bg-ink-faint/40";

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-ink-strong">
          {t.label}{" "}
          <span className="text-ink-faint">({t.kind === "salaried" ? "salaried" : "commission"})</span>
        </span>
        <span className="font-mono tabnum text-ink-muted">
          {Math.round(t.usedHours)}/{Math.round(t.capacityHours)} hrs · {pctDisplay}%
        </span>
      </div>
      <div className="h-1.5 bg-bg-elevated rounded overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-bg-elevated/30 border border-rule rounded-md p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] font-mono text-ink-faint uppercase tracking-wider">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function TierEditor({
  tier,
  showSalary,
  onChange,
  onRemove,
}: {
  tier: EngineerTier;
  showSalary?: boolean;
  onChange: (patch: Partial<EngineerTier>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="py-2.5 border-b border-rule/40 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={tier.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1 bg-bg-elevated border border-rule rounded px-2 py-1 text-[12px] text-ink-strong focus:outline-none focus:border-emerald"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-red hover:underline"
          title="Remove tier"
        >
          Remove
        </button>
      </div>
      <div className={`grid gap-2 ${showSalary ? "grid-cols-4" : "grid-cols-3"}`}>
        <Num label="Count" value={tier.count} step={1} onChange={(v) => onChange({ count: v })} />
        {showSalary && (
          <Num
            label="Salary ($/mo)"
            value={tier.monthlySalary}
            step={500}
            onChange={(v) => onChange({ monthlySalary: v })}
          />
        )}
        <Num
          label="Commission (%)"
          value={tier.commissionRate * 100}
          step={0.5}
          onChange={(v) => onChange({ commissionRate: v / 100 })}
        />
        <Num
          label="Hrs/mo each"
          value={tier.hoursPerMonth}
          step={10}
          onChange={(v) => onChange({ hoursPerMonth: v })}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-faint">
        <span>
          Capacity: <span className="tabnum">{tier.count * tier.hoursPerMonth}</span> hrs/mo
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={tier.appliesTo === "projects+retainers"}
            onChange={(e) =>
              onChange({ appliesTo: e.target.checked ? "projects+retainers" : "projects" })
            }
            className="accent-emerald"
          />
          <span>Include retainers in commission base</span>
        </label>
      </div>
    </div>
  );
}

function Num({
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

function Kpi({
  label,
  value,
  tone = "ink",
  muted,
}: {
  label: string;
  value: string;
  tone?: "ink" | "emerald" | "amber" | "red";
  muted?: boolean;
}) {
  const toneClass =
    tone === "emerald" ? "text-emerald" : tone === "amber" ? "text-amber" : tone === "red" ? "text-red" : "text-ink-strong";
  return (
    <div className={`rounded border border-rule/60 px-2.5 py-1.5 ${muted ? "bg-transparent" : "bg-surface/40"}`}>
      <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">{label}</div>
      <div className={`mt-0.5 text-[14px] font-semibold tabnum font-mono ${toneClass}`}>{value}</div>
    </div>
  );
}
