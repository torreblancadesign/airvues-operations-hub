"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Story, COMMISSION_RATE } from "@/lib/engineering-types";
import { EngineerCapacity, SprintPlan } from "@/lib/sprint-plan-types";
import { planStory, setStorySprint } from "@/lib/mutations/story";
import { StatCard } from "@/components/ui/StatCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { GoalBar } from "@/components/home/GoalBar";
import { StorySheet } from "@/components/engineering/StorySheet";

type Props = {
  plan: SprintPlan;
  canEdit: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function priorityDot(p: string | null): string {
  switch (p) {
    case "Urgent": return "bg-red";
    case "High": return "bg-amber";
    case "Medium": return "bg-sky";
    case "Low": return "bg-ink-faint";
    default: return "bg-bg-elevated";
  }
}

export function SprintPlanBoard({ plan, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);
  const [openStory, setOpenStory] = useState<Story | null>(null);

  function doPlan(story: Story, engineerId: string) {
    setError(null);
    setPendingStoryId(story.id);
    const newSprintIds = story.sprintIds.includes(plan.sprintId)
      ? story.sprintIds
      : [...story.sprintIds, plan.sprintId];
    const newAssigneeIds = story.assigneeIds.includes(engineerId)
      ? story.assigneeIds
      : [...story.assigneeIds, engineerId];
    startTransition(async () => {
      const result = await planStory(story.id, newSprintIds, newAssigneeIds);
      if ("ok" in result) {
        router.refresh();
      } else {
        setError(`Plan failed: ${result.error}`);
      }
      setPendingStoryId(null);
    });
  }

  function doUnplan(story: Story) {
    setError(null);
    setPendingStoryId(story.id);
    const newSprintIds = story.sprintIds.filter((id) => id !== plan.sprintId);
    startTransition(async () => {
      const result = await setStorySprint(story.id, newSprintIds);
      if ("ok" in result) {
        router.refresh();
      } else {
        setError(`Unplan failed: ${result.error}`);
      }
      setPendingStoryId(null);
    });
  }

  const capacityTone =
    plan.totalCommitted > plan.totalCapacity
      ? "red"
      : plan.totalCommitted > plan.totalCapacity * 0.85
        ? "amber"
        : "emerald";

  const engineers = plan.engineers;

  return (
    <>
      {error && (
        <div className="mb-3 bg-red/10 border border-red/30 rounded-md px-3 py-2 text-[12px] text-red font-mono">
          {error}
        </div>
      )}

      {/* Capacity overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Total capacity"
          value={`${plan.totalCapacity}h`}
          sub={`${engineers.length} engineers × 80h/sprint`}
        />
        <StatCard
          label="Committed"
          tone={capacityTone}
          value={`${plan.totalCommitted.toFixed(0)}h`}
          sub={`${plan.totalCapacity > 0 ? Math.round((plan.totalCommitted / plan.totalCapacity) * 100) : 0}% utilization`}
        />
        <StatCard
          label="Free"
          tone={plan.totalFree >= 0 ? "emerald" : "red"}
          value={`${plan.totalFree.toFixed(0)}h`}
          sub={plan.totalFree >= 0 ? "Room for more" : "Overcommitted"}
        />
        <StatCard
          label="Backlog pool"
          value={plan.backlog.length.toLocaleString()}
          sub={`${plan.backlog.reduce((s, b) => s + (b.hours ?? 0), 0).toFixed(0)}h of unplanned work`}
        />
      </div>

      <GoalBar
        label="Sprint Capacity Used"
        value={plan.totalCommitted}
        target={plan.totalCapacity}
        formatValue={(n) => `${Math.round(n)}h`}
        tone={capacityTone}
        rightLabel={plan.totalCapacity > 0 ? `${Math.round((plan.totalCommitted / plan.totalCapacity) * 100)}%` : "—"}
        sub={
          plan.totalCommitted > plan.totalCapacity
            ? `Overcommitted by ${(plan.totalCommitted - plan.totalCapacity).toFixed(0)}h · rebalance to engineers with free capacity`
            : `${plan.totalFree.toFixed(0)}h of free capacity across the team`
        }
      />

      {/* Engineers section */}
      <div className="mt-6 mb-8">
        <SectionTitle title="Engineers" aside={`${engineers.length} active · click × to remove a story`} />
        <div className="space-y-3">
          {engineers.map((e) => (
            <EngineerRow
              key={e.id}
              engineer={e}
              canEdit={canEdit}
              pending={pending}
              pendingStoryId={pendingStoryId}
              onUnplan={doUnplan}
              onOpenStory={setOpenStory}
            />
          ))}
        </div>
      </div>

      {/* Backlog pool */}
      <div>
        <SectionTitle
          title="Backlog Pool"
          aside={`${plan.backlog.length} unscheduled · click engineer chip to plan`}
        />
        {plan.backlog.length === 0 ? (
          <div className="bg-surface border border-rule rounded-card p-6 text-center text-[12px] text-ink-muted">
            Backlog is empty. Refine more stories in <Link href="/backlog" className="text-emerald hover:underline">/backlog</Link>.
          </div>
        ) : (
          <div className="bg-surface border border-rule rounded-card divide-y divide-rule">
            {plan.backlog.slice(0, 50).map((s) => (
              <BacklogPlanRow
                key={s.id}
                story={s}
                engineers={engineers}
                canEdit={canEdit}
                pending={pending}
                pendingStoryId={pendingStoryId}
                onPlan={doPlan}
                onOpenStory={setOpenStory}
              />
            ))}
            {plan.backlog.length > 50 && (
              <div className="px-4 py-3 text-[11px] font-mono text-ink-faint tabnum text-center">
                Showing first 50 · {plan.backlog.length - 50} more in{" "}
                <Link href="/backlog" className="text-emerald hover:underline">/backlog</Link>
              </div>
            )}
          </div>
        )}
      </div>

      <StorySheet
        story={openStory}
        engineers={engineers.map((e) => ({ id: e.id, name: e.name }))}
        canEdit={canEdit}
        onClose={() => setOpenStory(null)}
        onFilterByEngineer={() => setOpenStory(null)}
        onFilterByClient={() => setOpenStory(null)}
      />
    </>
  );
}

function EngineerRow({
  engineer,
  canEdit,
  pending,
  pendingStoryId,
  onUnplan,
  onOpenStory,
}: {
  engineer: EngineerCapacity;
  canEdit: boolean;
  pending: boolean;
  pendingStoryId: string | null;
  onUnplan: (s: Story) => void;
  onOpenStory: (s: Story) => void;
}) {
  const over = engineer.committedHours > engineer.capacity;
  const tone = over ? "bg-red" : engineer.utilizationPct > 85 ? "bg-amber" : "bg-emerald";

  return (
    <div className="bg-surface border border-rule rounded-card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap border-b border-rule">
        <div>
          <div className="text-[14px] font-semibold text-ink-strong leading-tight">
            {engineer.name}
          </div>
          {engineer.role && (
            <div className="text-[11px] text-ink-muted mt-0.5">{engineer.role}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
            {engineer.committedStories.length} stories · {fmtMoney(engineer.committedCommission)} commission
          </div>
          <div className={`text-[16px] font-semibold tabnum ${over ? "text-red" : ""}`}>
            {engineer.committedHours.toFixed(0)}h <span className="text-ink-faint">/ {engineer.capacity}h</span>
            <span className="text-ink-muted text-[12px] ml-2">{Math.round(engineer.utilizationPct)}%</span>
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5">
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden mb-3">
          <div
            className={`h-full ${tone} rounded-full transition-all`}
            style={{ width: `${Math.min(100, engineer.utilizationPct)}%` }}
          />
        </div>
        {engineer.committedStories.length === 0 ? (
          <div className="text-[12px] text-ink-faint italic">No stories planned for this sprint yet.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {engineer.committedStories.map((s) => {
              const isPending = pendingStoryId === s.id && pending;
              return (
                <span
                  key={s.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] bg-bg-elevated border border-rule rounded transition-opacity ${
                    isPending ? "opacity-50" : ""
                  }`}
                >
                  <span
                    className={`w-1 h-1 rounded-full ${priorityDot(s.priority)}`}
                    aria-label={s.priority ?? ""}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenStory(s)}
                    className="text-ink-strong hover:text-emerald transition-colors text-left max-w-[200px] truncate"
                  >
                    {s.name}
                  </button>
                  <span className="text-ink-faint font-mono">· {s.hours ?? "?"}h</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onUnplan(s)}
                      disabled={pending}
                      className="text-ink-faint hover:text-red text-[12px] leading-none disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Remove ${s.name} from sprint`}
                      title="Remove from sprint"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BacklogPlanRow({
  story,
  engineers,
  canEdit,
  pending,
  pendingStoryId,
  onPlan,
  onOpenStory,
}: {
  story: Story;
  engineers: EngineerCapacity[];
  canEdit: boolean;
  pending: boolean;
  pendingStoryId: string | null;
  onPlan: (s: Story, engineerId: string) => void;
  onOpenStory: (s: Story) => void;
}) {
  const isThisPending = pendingStoryId === story.id && pending;
  const isOtherPending = pending && pendingStoryId !== story.id;

  return (
    <div
      className={`px-4 py-2.5 flex items-center gap-3 flex-wrap hover:bg-bg-elevated/60 transition-colors ${
        isThisPending ? "opacity-50" : isOtherPending ? "opacity-70" : ""
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot(story.priority)}`}
        aria-label={story.priority ?? ""}
      />
      <span className="text-[10px] font-mono text-ink-faint tabnum shrink-0">
        #{story.storyNumber ?? "?"}
      </span>
      <button
        type="button"
        onClick={() => onOpenStory(story)}
        className="text-[13px] text-ink-strong hover:text-emerald transition-colors text-left flex-1 min-w-[200px] truncate"
      >
        {story.name}
      </button>
      <span className="text-[11px] text-ink-muted whitespace-nowrap">
        {story.clientNames[0] ?? "—"}
      </span>
      <span className="text-[11px] font-mono tabnum text-ink-muted whitespace-nowrap">
        {story.hours ?? "?"}h
      </span>
      <span className="text-[12px] font-semibold text-ink-strong tabnum whitespace-nowrap">
        {fmtMoney(story.invoice)}
      </span>
      {canEdit && (
        <div className="flex gap-1 flex-wrap">
          {engineers.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPlan(story, e.id)}
              disabled={pending}
              className="px-2 py-0.5 text-[10px] bg-bg-elevated border border-rule rounded text-ink-muted hover:text-emerald hover:border-emerald transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title={`Plan for ${e.name}`}
            >
              → {e.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
