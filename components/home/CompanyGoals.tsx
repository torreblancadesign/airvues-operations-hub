// 2026 Company Goals — 3 stacked progress bars: Revenue, Bonus Stretch, Retainer Mix.
// Pure presentational; data flows in via props from the home page server component.

import { GoalBar } from "./GoalBar";
import { SectionTitle } from "@/components/ui/SectionTitle";

const REVENUE_GOAL = 500_000;
const BONUS_STRETCH = 750_000;
const RETAINER_TARGET_PCT = 0.5;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type Props = {
  ytdRevenue: number;
  retainerCount: number;
  activeClients: number;
};

export function CompanyGoals({ ytdRevenue, retainerCount, activeClients }: Props) {
  // Tone logic for revenue: amber if behind pace, emerald if ahead
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearProgress = (today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 365);
  const revenueProgress = ytdRevenue / REVENUE_GOAL;
  const revenueTone =
    revenueProgress >= yearProgress ? "emerald" : revenueProgress >= yearProgress * 0.7 ? "amber" : "red";

  const bonusTier =
    ytdRevenue >= BONUS_STRETCH ? "15% tier · unlocked" : ytdRevenue >= REVENUE_GOAL ? "10% tier · unlocked" : "Not yet unlocked";

  const retainerTarget = Math.max(1, Math.ceil(activeClients * RETAINER_TARGET_PCT));
  const retainerPct = activeClients > 0 ? retainerCount / activeClients : 0;
  const retainerTone =
    retainerPct >= RETAINER_TARGET_PCT ? "emerald" : retainerPct >= RETAINER_TARGET_PCT * 0.6 ? "amber" : "red";

  return (
    <div className="mb-8">
      <SectionTitle
        title="2026 Goals"
        aside={
          <span className="font-mono text-[11px] text-ink-faint tabnum">
            Year · {Math.round(yearProgress * 100)}% elapsed
          </span>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <GoalBar
          label="Annual Revenue"
          value={ytdRevenue}
          target={REVENUE_GOAL}
          stretch={BONUS_STRETCH}
          formatValue={fmtMoney}
          tone={revenueTone}
          rightLabel="2026 goal"
          sub={`${bonusTier} · hitting stretch funds the team bonus pool`}
        />
        <GoalBar
          label="Bonus Pool Tier"
          value={ytdRevenue}
          target={REVENUE_GOAL}
          stretch={BONUS_STRETCH}
          formatValue={fmtMoney}
          tone={ytdRevenue >= REVENUE_GOAL ? "violet" : "sky"}
          rightLabel={ytdRevenue >= BONUS_STRETCH ? "Tier 2" : ytdRevenue >= REVENUE_GOAL ? "Tier 1" : "Locked"}
          sub={
            ytdRevenue >= BONUS_STRETCH
              ? "Maxed out — 15% revenue tier funds bonuses"
              : ytdRevenue >= REVENUE_GOAL
                ? `10% tier active. ${fmtMoney(BONUS_STRETCH - ytdRevenue)} more unlocks the 15% tier.`
                : `${fmtMoney(REVENUE_GOAL - ytdRevenue)} more to unlock the 10% tier.`
          }
        />
        <GoalBar
          label="Clients on Retainer"
          value={retainerCount}
          target={retainerTarget}
          formatValue={(n) => `${n}`}
          tone={retainerTone}
          rightLabel="50% mix target"
          sub={`${retainerCount} of ${activeClients} active clients on a Recurring subscription`}
        />
      </div>
    </div>
  );
}
