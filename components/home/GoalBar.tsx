// Animated horizontal progress bar with optional stretch marker.
// Used for company goals + personal scorecard targets.

type Tone = "emerald" | "amber" | "red" | "sky" | "violet";

const TONE_FILL: Record<Tone, string> = {
  emerald: "bg-emerald",
  amber: "bg-amber",
  red: "bg-red",
  sky: "bg-sky",
  violet: "bg-violet",
};

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald",
  amber: "text-amber",
  red: "text-red",
  sky: "text-sky",
  violet: "text-violet",
};

type Props = {
  label: string;
  value: number;
  target: number;
  stretch?: number;
  formatValue: (n: number) => string;
  tone?: Tone;
  sub?: string;
  rightLabel?: string;
};

export function GoalBar({
  label,
  value,
  target,
  stretch,
  formatValue,
  tone = "emerald",
  sub,
  rightLabel,
}: Props) {
  const pct = target > 0 ? (value / target) * 100 : 0;
  const stretchPct = stretch && target > 0 ? (stretch / target) * 100 : null;
  const displayPct = Math.min(100, Math.max(0, pct));

  const overTarget = value >= target;
  const stretchHit = stretch ? value >= stretch : false;

  return (
    <div className="bg-surface border border-rule rounded-card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <div className="eyebrow">{label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-semibold text-ink-strong tabnum">
              {formatValue(value)}
            </span>
            <span className="text-[12px] text-ink-muted font-mono tabnum">
              / {formatValue(target)}
            </span>
            {stretch && (
              <span className="text-[11px] text-ink-faint font-mono tabnum hidden sm:inline">
                → {formatValue(stretch)} stretch
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-[18px] font-semibold tabnum ${TONE_TEXT[tone]}`}>
            {Math.round(pct)}%
          </div>
          {rightLabel && (
            <div className="text-[10px] text-ink-faint font-mono tracking-wider uppercase mt-0.5">
              {rightLabel}
            </div>
          )}
        </div>
      </div>

      {/* The bar — fills from 0 to target on mount */}
      <div className="relative h-2.5 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full ${TONE_FILL[tone]} rounded-full motion-safe:animate-fill-bar`}
          style={{ width: `${displayPct}%`, ["--fill-target" as never]: `${displayPct}%` }}
        />
        {stretchPct != null && stretchPct > 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-ink-strong opacity-40"
            style={{ left: `${Math.min(100, (target / stretch!) * 100)}%` }}
            aria-label="target marker"
          />
        )}
      </div>

      {/* Stretch zone (only shown when stretch is configured and target hit) */}
      {stretch && stretch > target && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted font-mono tabnum">
          <span>
            Stretch{" "}
            <span className={stretchHit ? TONE_TEXT["emerald"] : "text-ink-faint"}>
              {formatValue(stretch)}
            </span>
          </span>
          <span>
            {stretchHit
              ? "unlocked"
              : `${formatValue(Math.max(0, stretch - value))} to unlock`}
          </span>
        </div>
      )}

      {sub && <div className="mt-2 text-[11px] text-ink-muted leading-snug">{sub}</div>}

      {overTarget && !stretch && (
        <div className="mt-2 text-[11px] text-emerald font-mono uppercase tracking-wider">
          ✓ Target hit
        </div>
      )}
    </div>
  );
}
