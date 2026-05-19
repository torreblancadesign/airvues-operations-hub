// Velocity Overview — aggregate stats across last N done sprints.
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sparkline } from "@/components/ui/Sparkline";
import { VelocityStats } from "@/lib/velocity";

type Props = {
  velocity: VelocityStats;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function trendBadge(stats: VelocityStats): { text: string; cls: string } {
  switch (stats.trendDirection) {
    case "up":
      return { text: `▲ ${stats.trendDelta.toFixed(1)}pp vs prior 3`, cls: "text-emerald" };
    case "down":
      return { text: `▼ ${Math.abs(stats.trendDelta).toFixed(1)}pp vs prior 3`, cls: "text-red" };
    case "flat":
      return { text: `→ flat (${stats.trendDelta.toFixed(1)}pp vs prior 3)`, cls: "text-ink-muted" };
    default:
      return { text: "Need 6+ done sprints", cls: "text-ink-faint" };
  }
}

export function VelocityOverview({ velocity }: Props) {
  if (velocity.doneSprintCount === 0) {
    return (
      <div className="mb-8 bg-surface border border-rule rounded-card p-5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
          Velocity
        </div>
        <div className="text-[13px] text-ink-strong font-semibold">
          No completed sprints yet
        </div>
        <div className="text-[12px] text-ink-muted mt-1 leading-snug">
          Velocity charts populate once sprints reach <span className="font-mono text-ink-strong">Sprint Status = Done</span>.
          Mark a sprint Done in Airtable (or via this dashboard) to start the timeline.
        </div>
      </div>
    );
  }

  const trend = trendBadge(velocity);
  const completionTone =
    velocity.avgCompletionPct >= 80 ? "emerald" : velocity.avgCompletionPct >= 60 ? "amber" : "red";

  const sparkValues = velocity.recentSprints.map((s) => s.completionPct);
  const sparkLabels = velocity.recentSprints.map(
    (s) => `Sprint ${s.number ?? "?"}`,
  );

  return (
    <div className="mb-8">
      <SectionTitle
        title="Velocity"
        aside={
          <span className={`font-mono text-[11px] ${trend.cls}`}>{trend.text}</span>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard
          label="Avg completion"
          tone={completionTone}
          value={`${Math.round(velocity.avgCompletionPct)}%`}
          sub={`Across last ${Math.min(6, velocity.doneSprintCount)} done sprints`}
        />
        <StatCard
          label="$ shipped / sprint"
          tone="emerald"
          value={fmtMoney(velocity.avgDeliveredInvoice)}
          sub="Avg invoice $ delivered (proportional to completion)"
        />
        <StatCard
          label="Stories / sprint"
          value={velocity.avgStoriesPerSprint.toFixed(1)}
          sub="Avg done count"
        />
        <StatCard
          label="Hours scoped / sprint"
          value={`${velocity.avgHoursPerSprint.toFixed(0)}h`}
          sub="Avg hours committed"
        />
      </div>

      <div className="bg-surface border border-rule rounded-card p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
            Completion % · last {velocity.recentSprints.length} sprints
          </div>
          <Sparkline
            values={sparkValues}
            labels={sparkLabels}
            max={100}
            tone={completionTone}
            width={Math.max(120, velocity.recentSprints.length * 18)}
          />
        </div>
        <div className="flex items-center gap-6">
          {velocity.bestSprint && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald mb-1">
                Best
              </div>
              <Link
                href={`/sprints/${velocity.bestSprint.id}`}
                className="text-[13px] font-semibold text-ink-strong hover:text-emerald transition-colors"
              >
                Sprint #{velocity.bestSprint.number}
              </Link>
              <div className="text-[11px] text-ink-muted">
                {Math.round(velocity.bestSprint.completionPct)}% completion
              </div>
            </div>
          )}
          {velocity.worstSprint && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-red mb-1">
                Worst
              </div>
              <Link
                href={`/sprints/${velocity.worstSprint.id}`}
                className="text-[13px] font-semibold text-ink-strong hover:text-emerald transition-colors"
              >
                Sprint #{velocity.worstSprint.number}
              </Link>
              <div className="text-[11px] text-ink-muted">
                {Math.round(velocity.worstSprint.completionPct)}% completion
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
