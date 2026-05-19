// Tiny SVG sparkline for time-series data. Pure SVG, no deps.

type Props = {
  values: number[];
  labels?: string[];
  height?: number;
  width?: number;
  max?: number;
  tone?: "emerald" | "amber" | "red" | "sky" | "violet";
};

const TONE_HEX: Record<NonNullable<Props["tone"]>, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
};

export function Sparkline({
  values,
  labels,
  height = 40,
  width = 240,
  max,
  tone = "emerald",
}: Props) {
  if (values.length === 0) {
    return <div className="text-[11px] text-ink-faint">No data</div>;
  }

  const ceiling = max ?? Math.max(...values, 1);
  const barCount = values.length;
  const barWidth = barCount > 0 ? (width - (barCount - 1) * 2) / barCount : 0;
  const color = TONE_HEX[tone];

  return (
    <div className="inline-block">
      <svg width={width} height={height} role="img" aria-label="Sparkline">
        {values.map((v, i) => {
          const ratio = ceiling > 0 ? Math.min(1, Math.max(0, v / ceiling)) : 0;
          const h = ratio * height;
          const x = i * (barWidth + 2);
          const y = height - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              fill={color}
              opacity={i === values.length - 1 ? 1 : 0.6}
              rx={1.5}
            >
              {labels?.[i] && <title>{labels[i]}: {Math.round(v)}</title>}
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
