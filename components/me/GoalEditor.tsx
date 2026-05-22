"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GoalBar } from "@/components/home/GoalBar";
import { updateAnnualEarningsGoal } from "@/lib/mutations/person";

type Props = {
  personId: string;
  currentGoal: number | null;
  ytdEarnings: number;
  goalRemaining: number | null;
  monthlyPaceNeeded: number | null;
  expectedYtdAtPace: number | null;
  monthsRemaining: number;
  onTrack: boolean;
  canEdit: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function GoalEditor({
  personId,
  currentGoal,
  ytdEarnings,
  goalRemaining,
  monthlyPaceNeeded,
  expectedYtdAtPace,
  monthsRemaining,
  onTrack,
  canEdit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(currentGoal != null ? String(currentGoal) : "");
  const [error, setError] = useState<string | null>(null);
  // Optimistic value so the UI updates immediately while revalidation happens.
  const [optimistic, setOptimistic] = useState<number | null | undefined>(undefined);

  const effectiveGoal = optimistic !== undefined ? optimistic : currentGoal;

  const save = (value: number | null) => {
    setError(null);
    startTransition(async () => {
      const res = await updateAnnualEarningsGoal({ personId, goal: value });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOptimistic(value);
      setEditing(false);
      router.refresh();
    });
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      save(null);
      return;
    }
    const parsed = Number(trimmed.replace(/[,$\s]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a non-negative dollar amount.");
      return;
    }
    save(parsed);
  };

  if (editing) {
    return (
      <div className="bg-surface border border-emerald/50 rounded-card p-5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-emerald mb-2">
          Edit annual earnings goal
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint text-[14px] font-mono">$</span>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="100000"
              className="pl-7 pr-3 py-1.5 text-[14px] font-mono tabnum bg-bg border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none w-[180px]"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="px-3 py-1.5 text-[12px] font-medium bg-emerald text-bg rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); setDraft(currentGoal != null ? String(currentGoal) : ""); }}
            disabled={isPending}
            className="px-3 py-1.5 text-[12px] text-ink-muted hover:text-ink-strong"
          >
            Cancel
          </button>
          {effectiveGoal != null && (
            <button
              type="button"
              onClick={() => save(null)}
              disabled={isPending}
              className="ml-auto text-[11px] text-red hover:underline"
            >
              Clear goal
            </button>
          )}
        </div>
        {error && <div className="text-[11px] text-red mt-2">{error}</div>}
        <div className="text-[11px] text-ink-faint mt-2">
          Enter the total dollar amount you want to earn in commission this year.
        </div>
      </div>
    );
  }

  if (effectiveGoal != null && effectiveGoal > 0) {
    return (
      <div className="relative">
        {canEdit && (
          <button
            type="button"
            onClick={() => { setDraft(String(effectiveGoal)); setEditing(true); }}
            className="absolute top-0 right-0 -translate-y-6 text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition-colors"
          >
            Edit
          </button>
        )}
        <GoalBar
          label="YTD earnings"
          value={ytdEarnings}
          target={effectiveGoal}
          formatValue={fmtMoney}
          tone={onTrack ? "emerald" : "amber"}
          rightLabel={onTrack ? "On pace" : "Push needed"}
          sub={
            ytdEarnings >= effectiveGoal
              ? `Goal hit. ${fmtMoney(ytdEarnings - effectiveGoal)} over target.`
              : `${fmtMoney(goalRemaining ?? Math.max(0, effectiveGoal - ytdEarnings))} to go · need ${fmtMoney(monthlyPaceNeeded ?? (effectiveGoal - ytdEarnings) / Math.max(0.1, monthsRemaining))}/mo for the next ${monthsRemaining.toFixed(1)} months. Expected pace at this point: ${fmtMoney(expectedYtdAtPace ?? 0)}.`
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-surface border border-dashed border-rule rounded-card p-5">
      <div className="text-[13px] font-semibold text-ink-strong mb-1">
        Set an annual earnings goal
      </div>
      <div className="text-[12px] text-ink-muted leading-snug mb-3">
        Set a yearly commission target and this page will track your YTD progress
        and tell you the monthly pace needed to hit it.
      </div>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 text-[12px] font-medium bg-emerald text-bg rounded-md hover:opacity-90"
        >
          Set goal
        </button>
      ) : (
        <div className="text-[11px] text-ink-faint">
          Ask an admin to set this for you.
        </div>
      )}
    </div>
  );
}
