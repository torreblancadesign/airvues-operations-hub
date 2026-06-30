"use client";

// Sleek cumulative revenue trend rendered inside the Firm Pulse hero tile.
// Pure SVG — no chart lib. Shows actual collected revenue line + faint dashed
// pace baseline so the under/over-pace story is instant.
import { useMemo, useRef, useState, useId } from "react";
import type { TrendPoint } from "@/lib/firm-pulse";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

const W = 600;
const H = 140;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 22;

export function RevenueTrend({
  series,
  target,
  windowName,
}: {
  series: TrendPoint[];
  target: number;
  windowName: "ytd" | "mtd";
}) {
  const gradId = useId();
  const clipId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { points, bars, areaPath, linePath, paceY, innerW, innerH } = useMemo(() => {
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const maxVal = Math.max(target, ...series.map((p) => p.value), 1);
    const yMax = maxVal * 1.05;

    // Distribute across the full window so an in-progress period trails off
    // mid-frame rather than stretching to the right edge.
    const now = new Date();
    const slots =
      windowName === "ytd"
        ? 12
        : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const xFor = (i: number) =>
      PAD_L + (slots <= 1 ? innerW / 2 : (i / (slots - 1)) * innerW);
    const yFor = (v: number) => PAD_T + innerH - (v / yMax) * innerH;

    const points = series.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.value) }));

    // Monthly bars (YTD only). Independent y-scale capped at ~55% of inner
    // height so the cumulative line stays visually dominant.
    const monthlyMax = Math.max(0, ...series.map((p) => p.monthly ?? 0));
    const barMaxH = innerH * 0.55;
    const barStep = slots > 1 ? innerW / (slots - 1) : innerW;
    const barW = Math.max(6, Math.min(28, barStep * 0.55));
    const bars =
      windowName === "ytd" && monthlyMax > 0
        ? points.map((pt) => {
            const m = pt.monthly ?? 0;
            const h = monthlyMax > 0 ? (m / monthlyMax) * barMaxH : 0;
            return {
              x: pt.x - barW / 2,
              y: PAD_T + innerH - h,
              w: barW,
              h,
              monthly: m,
            };
          })
        : [];

    if (points.length === 0) {
      return {
        points,
        bars,
        areaPath: "",
        linePath: "",
        paceY: yFor(target),
        innerW,
        innerH,
      };
    }

    const lineD = points
      .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(" ");
    const last = points[points.length - 1];
    const first = points[0];
    const areaD = `${lineD} L${last.x.toFixed(2)} ${(PAD_T + innerH).toFixed(2)} L${first.x.toFixed(2)} ${(PAD_T + innerH).toFixed(2)} Z`;
    const paceY = yFor(target);

    return { points, bars, areaPath: areaD, linePath: lineD, paceY, innerW, innerH };
  }, [series, target, windowName]);

  if (series.length === 0) {
    return (
      <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
        No revenue collected yet this {windowName === "ytd" ? "year" : "month"}.
      </div>
    );
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xPx = PAD_L + xRatio * (W - PAD_L - PAD_R);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - xPx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };

  const hover = hoverIdx != null ? points[hoverIdx] : null;
  // pace target — annual for YTD, monthly for MTD.
  const targetLabel = `Target ${fmtCompact(target)}`;
  const firstLabel = points[0]?.label;
  const lastLabel = points[points.length - 1]?.label;

  return (
    <div className="relative w-full select-none" aria-hidden>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[140px] block"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3A8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22D3A8" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* Monthly revenue bars (YTD only) — sit behind line/area */}
        {bars.map((b, i) => {
          const active = hoverIdx === i;
          return (
            <rect
              key={`bar-${i}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={1.5}
              fill="#22D3A8"
              opacity={active ? 0.45 : 0.18}
            />
          );
        })}

        {/* Pace baseline (linear progress toward target) */}
        <line
          x1={PAD_L}
          y1={PAD_T + innerH}
          x2={W - PAD_R}
          y2={paceY}
          stroke="rgba(148,163,184,0.35)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        {/* Area fill */}
        <path
          key={`area-${windowName}`}
          d={areaPath}
          fill={`url(#${gradId})`}
          clipPath={`url(#${clipId})`}
          className="trend-area"
        />

        {/* Line */}
        <path
          key={`line-${windowName}`}
          d={linePath}
          fill="none"
          stroke="#22D3A8"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trend-line"
          style={{ filter: "drop-shadow(0 0 6px rgba(34,211,168,0.35))" }}
        />

        {/* Endpoint dot */}
        {points.length > 0 && (
          <>
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={5}
              fill="#22D3A8"
              opacity={0.25}
            />
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={2.5}
              fill="#22D3A8"
            />
          </>
        )}

        {/* Hover guide */}
        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="rgba(148,163,184,0.5)"
              strokeWidth={1}
            />
            <circle cx={hover.x} cy={hover.y} r={3.5} fill="#22D3A8" />
          </>
        )}

        {/* Axis hints — first + last period labels */}
        <text
          x={PAD_L}
          y={H - 6}
          fill="rgba(148,163,184,0.6)"
          fontSize="9"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          letterSpacing="0.1em"
        >
          {firstLabel?.toUpperCase()}
        </text>
        <text
          x={W - PAD_R}
          y={H - 6}
          fill="rgba(148,163,184,0.6)"
          fontSize="9"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          letterSpacing="0.1em"
          textAnchor="end"
        >
          {lastLabel?.toUpperCase()}
        </text>

        {/* Target tick label, top-right */}
        <text
          x={W - PAD_R}
          y={Math.max(PAD_T + 9, paceY - 4)}
          fill="rgba(148,163,184,0.55)"
          fontSize="9"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          letterSpacing="0.1em"
          textAnchor="end"
        >
          {targetLabel.toUpperCase()}
        </text>
      </svg>

      {/* Hover chip */}
      {hover && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full bg-bg/95 border border-rule rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-ink-strong tabnum whitespace-nowrap shadow-lg"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            marginTop: -6,
          }}
        >
          <div>
            <span className="text-ink-faint mr-1.5">{hover.label}</span>
            {hover.monthly != null ? fmtUsd(hover.monthly) : fmtUsd(hover.value)}
            {hover.monthly != null && (
              <span className="text-ink-faint ml-1">this month</span>
            )}
          </div>
          {hover.monthly != null && (
            <div className="text-ink-muted mt-0.5">
              {fmtUsd(hover.value)} <span className="text-ink-faint">YTD</span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .trend-line {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: trend-draw 900ms ease-out forwards;
        }
        .trend-area {
          opacity: 0;
          animation: trend-fade 1100ms ease-out forwards;
          animation-delay: 200ms;
        }
        @keyframes trend-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes trend-fade {
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

