"use client";

import { useMemo, useState } from "react";
import {
  ScalingInputs,
  computeScalingCurve,
  DEFAULT_HOURS_PER_MONTH,
} from "@/lib/scaling-math";
import { fmtUsd, fmtPct1 } from "@/lib/founder-math";

const W = 640;
const H = 140;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 22;

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

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

  // X scale: project revenue
  const xMin = points[0]?.projectRevenue ?? 0;
  const xMax = points[points.length - 1]?.projectRevenue ?? 1;
  const xFor = (v: number) => {
    if (xMax === xMin) return PAD_L + (W - PAD_L - PAD_R) / 2;
    return PAD_L + ((v - xMin) / (xMax - xMin)) * (W - PAD_L - PAD_R);
  };

  // Find first index where demand crosses capacity (hire marker).
  const hireIdx = points.findIndex((p) => p.demandHours > p.capacityHours);

  const hover = hoverIdx != null ? points[hoverIdx] : null;

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
            Margin, capacity &amp; founder take-home as revenue grows
          </h3>
          <p className="text-[12px] text-ink-muted mt-1">
            Sweeps project revenue from current up to {maxMult}× with the same roster. Hover to inspect each step.
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

      <div className="mt-4 space-y-4">
        <ChartFrame
          title={`Margin %${autoHire ? " (post auto-hire)" : ""}`}
          subtitle={`Target ${fmtPct1(target)}`}
          yFormat={(v) => `${Math.round(v * 100)}%`}
          values={points.map((p) => (autoHire ? p.proposedMarginPct : p.marginPct))}
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          refLine={target}
          tone={(v) => (v >= target ? "#10b981" : v >= target - 0.05 ? "#f59e0b" : "#ef4444")}
          hoverIdx={hoverIdx}
          onMove={handleMove}
          onLeave={() => setHoverIdx(null)}
          hireIdx={hireIdx}
        />

        <ChartFrame
          title="Demand vs capacity (hrs/mo)"
          subtitle={
            autoHire
              ? `Capacity grows with proposed hires`
              : `Capacity ${Math.round(points[0]?.capacityHours ?? 0)} hrs`
          }
          yFormat={(v) => `${Math.round(v)}h`}
          values={points.map((p) => p.demandHours)}
          secondaryValues={points.map((p) =>
            autoHire ? p.proposedFteCapacity * DEFAULT_HOURS_PER_MONTH : p.capacityHours,
          )}
          secondaryTone="#10b981"
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          tone={(v) =>
            v > (points[0]?.capacityHours ?? Infinity) ? "#ef4444" : "#0ea5e9"
          }
          hoverIdx={hoverIdx}
          onMove={handleMove}
          onLeave={() => setHoverIdx(null)}
          hireIdx={hireIdx}
        />

        <ChartFrame
          title="Retainer vs project hours (hrs/mo)"
          subtitle="Violet = retainers · Sky = projects"
          yFormat={(v) => `${Math.round(v)}h`}
          values={points.map((p) => p.projectHours)}
          secondaryValues={points.map((p) => p.retainerHours)}
          secondaryTone="#8b5cf6"
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          tone={() => "#0ea5e9"}
          hoverIdx={hoverIdx}
          onMove={handleMove}
          onLeave={() => setHoverIdx(null)}
          hireIdx={hireIdx}
        />

        <ChartFrame
          title="Team size (FTEs · 160h = 1)"
          subtitle={
            autoHire ? "Sky = demand · Emerald = proposed capacity" : "Sky = demand · Emerald = capacity"
          }
          yFormat={(v) => v.toFixed(1)}
          values={points.map((p) => p.fteDemand)}
          secondaryValues={points.map((p) =>
            autoHire ? p.proposedFteCapacity : p.fteCapacity,
          )}
          secondaryTone="#10b981"
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          tone={() => "#0ea5e9"}
          hoverIdx={hoverIdx}
          onMove={handleMove}
          onLeave={() => setHoverIdx(null)}
          hireIdx={hireIdx}
        />

        <ChartFrame
          title="Founder net / mo"
          subtitle={monthlyGoal > 0 ? `Goal ${fmtCompact(monthlyGoal)}` : undefined}
          yFormat={(v) => fmtCompact(v)}
          values={points.map((p) =>
            autoHire ? p.proposedFounderNetMonthly : p.founderNetMonthly,
          )}
          xValues={points.map((p) => p.projectRevenue)}
          xFor={xFor}
          refLine={monthlyGoal}
          refIsAbsolute
          tone={(v) => (v >= monthlyGoal ? "#10b981" : "#8b5cf6")}
          hoverIdx={hoverIdx}
          onMove={handleMove}
          onLeave={() => setHoverIdx(null)}
          hireIdx={hireIdx}
        />
      </div>

      {/* Synced readout */}
      <div className="mt-4 bg-bg-elevated/40 border border-rule rounded-md p-3 text-[12px]">
        {hover ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Readout label="Project rev" value={fmtUsd(hover.projectRevenue)} />
            <Readout label="Retainer rev" value={fmtUsd(hover.retainerRevenue)} />
            <Readout label="Project hrs" value={`${Math.round(hover.projectHours)} h`} />
            <Readout label="Retainer hrs" value={`${Math.round(hover.retainerHours)} h`} />
            <Readout
              label="Margin"
              value={fmtPct1(autoHire ? hover.proposedMarginPct : hover.marginPct)}
              tone={
                (autoHire ? hover.proposedMarginPct : hover.marginPct) >= target
                  ? "emerald"
                  : (autoHire ? hover.proposedMarginPct : hover.marginPct) >= target - 0.05
                    ? "amber"
                    : "red"
              }
            />
            <Readout
              label="FTEs (demand / cap)"
              value={`${hover.fteDemand.toFixed(1)} / ${(autoHire ? hover.proposedFteCapacity : hover.fteCapacity).toFixed(1)}`}
              tone={
                hover.fteDemand > (autoHire ? hover.proposedFteCapacity : hover.fteCapacity)
                  ? "red"
                  : "ink"
              }
            />
            <Readout
              label="Founder net/mo"
              value={fmtUsd(autoHire ? hover.proposedFounderNetMonthly : hover.founderNetMonthly)}
              tone="emerald"
            />
            <Readout
              label="Hires proposed"
              value={
                hover.proposal.addSalaried + hover.proposal.addCommission + hover.proposal.convertCommissionToSalaried > 0
                  ? `${hover.proposal.addSalaried > 0 ? `+${hover.proposal.addSalaried}S ` : ""}${hover.proposal.addCommission > 0 ? `+${hover.proposal.addCommission}C ` : ""}${hover.proposal.convertCommissionToSalaried > 0 ? `↑${hover.proposal.convertCommissionToSalaried}` : ""}`.trim()
                  : "—"
              }
              tone={
                hover.proposal.addSalaried + hover.proposal.addCommission + hover.proposal.convertCommissionToSalaried > 0
                  ? "amber"
                  : "ink"
              }
            />
          </div>
        ) : (
          <p className="text-ink-faint text-[11px]">Hover any chart to see the numbers at that revenue point.</p>
        )}
      </div>

      {/* Hiring roadmap */}
      {autoHire && (
        <HiringRoadmap points={points} />
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

function HiringRoadmap({ points }: { points: import("@/lib/scaling-math").ScalingCurvePoint[] }) {
  // Find revenue points where the proposal changes (cumulative growth in hires).
  const rows: { revenue: number; detail: string[] }[] = [];
  let prevS = 0, prevC = 0, prevConv = 0;
  for (const p of points) {
    const dS = p.proposal.addSalaried - prevS;
    const dC = p.proposal.addCommission - prevC;
    const dConv = p.proposal.convertCommissionToSalaried - prevConv;
    if (dS > 0 || dC > 0 || dConv > 0) {
      const parts: string[] = [];
      if (dS > 0) parts.push(`+${dS} salaried`);
      if (dC > 0) parts.push(`+${dC} commission`);
      if (dConv > 0) parts.push(`convert ${dConv} commission → salaried`);
      rows.push({ revenue: p.projectRevenue, detail: parts });
      prevS = p.proposal.addSalaried;
      prevC = p.proposal.addCommission;
      prevConv = p.proposal.convertCommissionToSalaried;
    }
  }
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 border border-rule rounded-md p-3 bg-bg-elevated/30">
      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-2">
        Hiring roadmap
      </div>
      <ul className="space-y-1 text-[12px]">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="font-mono tabnum text-ink-strong">{fmtCompact(r.revenue)}/mo</span>
            <span className="text-ink-muted">→</span>
            <span className="text-ink-strong">{r.detail.join(" · ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


function ChartFrame({
  title,
  subtitle,
  yFormat,
  values,
  xValues,
  xFor,
  refLine,
  refIsAbsolute,
  tone,
  hoverIdx,
  onMove,
  onLeave,
  hireIdx,
}: {
  title: string;
  subtitle?: string;
  yFormat: (v: number) => string;
  values: number[];
  xValues: number[];
  xFor: (v: number) => number;
  refLine?: number;
  refIsAbsolute?: boolean;
  tone: (v: number) => string;
  hoverIdx: number | null;
  onMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onLeave: () => void;
  hireIdx: number;
}) {
  const yMin = Math.min(0, ...values, refLine ?? 0);
  const yMax = Math.max(...values, refLine ?? 0, 1);
  const range = yMax - yMin || 1;
  const innerH = H - PAD_T - PAD_B;
  const yFor = (v: number) => PAD_T + innerH - ((v - yMin) / range) * innerH;

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(xValues[i]).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(" ");

  const lastColor = tone(values[values.length - 1] ?? 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">{title}</span>
        {subtitle && <span className="text-[10px] font-mono text-ink-faint">{subtitle}</span>}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[140px] block bg-bg-elevated/40 border border-rule rounded"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* y-axis ticks */}
        {[0, 0.5, 1].map((t) => {
          const v = yMin + t * range;
          const y = yFor(v);
          return (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(148,163,184,0.12)" />
              <text
                x={PAD_L - 6}
                y={y + 3}
                fontSize={9}
                fill="rgba(148,163,184,0.7)"
                fontFamily="ui-monospace, monospace"
                textAnchor="end"
              >
                {yFormat(v)}
              </text>
            </g>
          );
        })}

        {/* reference line */}
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

        {/* hire marker */}
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

        <path d={path} fill="none" stroke={lastColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />

        {/* points */}
        {values.map((v, i) => (
          <circle key={i} cx={xFor(xValues[i])} cy={yFor(v)} r={1.5} fill={tone(v)} />
        ))}

        {/* hover guide */}
        {hoverIdx != null && xValues[hoverIdx] != null && (
          <>
            <line
              x1={xFor(xValues[hoverIdx])}
              x2={xFor(xValues[hoverIdx])}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="rgba(148,163,184,0.6)"
              strokeWidth={1}
            />
            <circle
              cx={xFor(xValues[hoverIdx])}
              cy={yFor(values[hoverIdx])}
              r={3.5}
              fill={tone(values[hoverIdx])}
            />
          </>
        )}

        {/* x-axis labels */}
        <text
          x={PAD_L}
          y={H - 6}
          fontSize={9}
          fill="rgba(148,163,184,0.7)"
          fontFamily="ui-monospace, monospace"
        >
          {fmtCompact(xValues[0] ?? 0)}
        </text>
        <text
          x={W - PAD_R}
          y={H - 6}
          fontSize={9}
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

function Readout({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "emerald" | "amber" | "red";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald"
      : tone === "amber"
        ? "text-amber"
        : tone === "red"
          ? "text-red"
          : "text-ink-strong";
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`text-[13px] font-semibold tabnum font-mono ${toneClass}`}>{value}</div>
    </div>
  );
}
