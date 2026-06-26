"use client";

import { useMemo, useState } from "react";
import {
  CLIENT_SOLUTIONS_COMMISSION,
  COMMISSION_ONLY_ENGINEER_COMMISSION,
  SALARIED_ENGINEER_COMMISSION,
  ScalingInputs,
  ScalingOutput,
  computeScenario,
  defaultInputs,
} from "@/lib/scaling-math";
import { fmtPct1, fmtUsd } from "@/lib/founder-math";
import { useLocalStorageJSON } from "@/lib/use-local-storage";

type SavedScenario = { id: string; name: string; inputs: ScalingInputs };

const STORAGE_KEY = "founder:scaling-scenarios:v1";
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
  const [scenarios, setScenarios] = useLocalStorageJSON<SavedScenario[]>(STORAGE_KEY, []);
  const [scenarioName, setScenarioName] = useState("");

  const out = useMemo(() => computeScenario(inputs), [inputs]);

  const update = <K extends keyof ScalingInputs>(k: K, v: ScalingInputs[K]) =>
    setInputs((s) => ({ ...s, [k]: v }));

  const updateRole = (
    role: "salariedEngineers" | "commissionOnlyEngineers" | "clientSolutions",
    patch: Partial<ScalingInputs["salariedEngineers"]>,
  ) => setInputs((s) => ({ ...s, [role]: { ...s[role], ...patch } }));

  const mixPct = Math.round(inputs.salariedEngineerMix * 100);

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
            Model how team composition and revenue mix affect margins and founder take-home.
            Stays in your browser — no Airtable writes.
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
          <Card title="Revenue mix">
            <div className="grid grid-cols-2 gap-3">
              <Num label="Project revenue ($/mo)" value={inputs.monthlyProjectRevenue} step={1000}
                onChange={(v) => update("monthlyProjectRevenue", v)} />
              <Num label="Retainer revenue ($/mo)" value={inputs.monthlyRetainerRevenue} step={500}
                onChange={(v) => update("monthlyRetainerRevenue", v)} />
            </div>
            <div className="mt-2 text-[11px] font-mono text-ink-faint uppercase tracking-wider">
              Total: <span className="tabnum text-ink-strong">{fmtUsd(out.totalRevenue)}/mo</span>
            </div>
          </Card>

          {/* Team */}
          <Card title="Team composition">
            <RoleEditor
              label="Salaried engineers"
              role={inputs.salariedEngineers}
              showSalary
              defaultRate={SALARIED_ENGINEER_COMMISSION}
              onChange={(p) => updateRole("salariedEngineers", p)}
            />
            <RoleEditor
              label="Commission-only engineers"
              role={inputs.commissionOnlyEngineers}
              defaultRate={COMMISSION_ONLY_ENGINEER_COMMISSION}
              onChange={(p) => updateRole("commissionOnlyEngineers", p)}
            />
            {/* Engineer mix — splits project revenue between the two pools */}
            <div className="py-2.5 border-b border-rule/40">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[12px] text-ink-strong font-medium">Engineer mix</div>
                <div className="text-[11px] font-mono text-ink-faint tabnum">
                  {mixPct}% salaried · {100 - mixPct}% commission-only
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={mixPct}
                onChange={(e) => update("salariedEngineerMix", Number(e.target.value) / 100)}
                className="w-full accent-emerald"
              />
              <div className="mt-1 text-[10px] text-ink-faint">
                Each $ of project revenue is delivered by one engineer — commissions never stack.
                Salaried priority; commission-only handles the overflow.
              </div>
            </div>
            <RoleEditor
              label="Head of Client Solutions / sales"
              role={inputs.clientSolutions}
              showSalary
              defaultRate={CLIENT_SOLUTIONS_COMMISSION}
              rateHint="10% sales + 5% blueprint (applies to all new project revenue)"
              onChange={(p) => updateRole("clientSolutions", p)}
            />
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-rule/60">
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
        <Readout out={out} target={inputs.targetMarginPct} />
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
            <table className="w-full text-[13px] min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] font-mono text-ink-faint uppercase tracking-wider border-b border-rule">
                  <th className="py-2 px-5 sm:px-6">Scenario</th>
                  <th className="py-2 px-3 text-right">Revenue</th>
                  <th className="py-2 px-3 text-right">Team cost</th>
                  <th className="py-2 px-3 text-right">Gross profit</th>
                  <th className="py-2 px-3 text-right">Margin</th>
                  <th className="py-2 px-3 text-right">Founder net/mo</th>
                  <th className="py-2 px-3 text-right">Founder net/yr</th>
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
                      <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-muted">{fmtUsd(o.grossProfit)}</td>
                      <td className={`py-2.5 px-3 text-right tabnum font-mono ${marginColor(o.netMarginPct, s.inputs.targetMarginPct)}`}>{fmtPct1(o.netMarginPct)}</td>
                      <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-strong">{fmtUsd(o.founderNetMonthly)}</td>
                      <td className="py-2.5 px-3 text-right tabnum font-mono text-ink-strong">{fmtUsd(o.founderNetAnnual)}</td>
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
        Commission breakdown:{" "}
        <span className="tabnum">{fmtUsd(out.commissions.salariedEngineers)}</span> salaried eng ·{" "}
        <span className="tabnum">{fmtUsd(out.commissions.commissionOnlyEngineers)}</span> comm-only ·{" "}
        <span className="tabnum">{fmtUsd(out.commissions.clientSolutions)}</span> client solutions
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-elevated/30 border border-rule rounded-md p-3.5">
      <div className="text-[11px] font-mono text-ink-faint uppercase tracking-wider mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function RoleEditor({
  label,
  role,
  showSalary,
  defaultRate,
  rateHint,
  onChange,
}: {
  label: string;
  role: ScalingInputs["salariedEngineers"];
  showSalary?: boolean;
  defaultRate: number;
  rateHint?: string;
  onChange: (patch: Partial<ScalingInputs["salariedEngineers"]>) => void;
}) {
  return (
    <div className="py-2.5 border-b border-rule/40 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] text-ink-strong font-medium">{label}</div>
        <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">
          default {fmtPct1(defaultRate)}
        </div>
      </div>
      <div className={`grid gap-2 ${showSalary ? "grid-cols-3" : "grid-cols-2"}`}>
        <Num label="Count" value={role.count} step={1} onChange={(v) => onChange({ count: v })} />
        {showSalary && (
          <Num
            label="Salary ($/mo)"
            value={role.monthlySalary}
            step={500}
            onChange={(v) => onChange({ monthlySalary: v })}
          />
        )}
        <Num
          label="Commission (%)"
          value={role.commissionRate * 100}
          step={0.5}
          onChange={(v) => onChange({ commissionRate: v / 100 })}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-faint">
        <span>{rateHint ?? ""}</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={role.appliesTo === "projects+retainers"}
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
    <div className={`rounded-md border border-rule px-2.5 py-2 ${muted ? "bg-transparent" : "bg-bg-elevated/40"}`}>
      <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">{label}</div>
      <div className={`mt-0.5 text-[15px] font-semibold tabnum font-mono ${muted ? "text-ink-muted" : toneClass}`}>
        {value}
      </div>
    </div>
  );
}
