// "This Month" section — current-month revenue and MRR goal progress bars.
// Placed at top of /money. Constants are easy to tweak inline.

import { SectionTitle } from "@/components/ui/SectionTitle";
import { GoalBar } from "@/components/home/GoalBar";

const MONTHLY_REVENUE_GOAL = 50_000;
const MRR_GOAL = 10_000;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

type Props = {
  mtdRevenue: number;
  mtdPaidCount: number;
  mrr: number;
};

export function MonthlyFocus({ mtdRevenue, mtdPaidCount, mrr }: Props) {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const revenueProgress = MONTHLY_REVENUE_GOAL > 0 ? mtdRevenue / MONTHLY_REVENUE_GOAL : 0;
  const revenueTone: "emerald" | "amber" | "red" =
    revenueProgress >= monthProgress
      ? "emerald"
      : revenueProgress >= monthProgress * 0.7
        ? "amber"
        : "red";

  const mrrProgress = MRR_GOAL > 0 ? mrr / MRR_GOAL : 0;
  const mrrTone: "emerald" | "amber" | "red" =
    mrrProgress >= 1 ? "emerald" : mrrProgress >= 0.6 ? "amber" : "red";

  const pacingNote =
    revenueProgress >= monthProgress
      ? "On pace · ahead of month elapsed"
      : `Behind pace · ${fmtMoney(Math.max(0, MONTHLY_REVENUE_GOAL * monthProgress - mtdRevenue))} below the line`;

  return (
    <div className="mb-4">
      <SectionTitle
        title="This Month"
        aside={
          <span className="font-mono text-[11px] text-ink-faint tabnum">
            {monthLabel} · {Math.round(monthProgress * 100)}% elapsed
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GoalBar
          label="Monthly Revenue Goal"
          value={mtdRevenue}
          target={MONTHLY_REVENUE_GOAL}
          formatValue={fmtMoney}
          tone={revenueTone}
          rightLabel={`${monthLabel.split(" ")[0]} goal`}
          sub={pacingNote}
        />
        <GoalBar
          label="MRR Goal"
          value={mrr}
          target={MRR_GOAL}
          formatValue={fmtMoney}
          tone={mrrTone}
          rightLabel="Recurring target"
          sub={
            mrr >= MRR_GOAL
              ? "Target hit — recurring base covers the floor"
              : `${fmtMoney(MRR_GOAL - mrr)} more recurring to hit target`
          }
        />
      </div>
    </div>
  );
}
