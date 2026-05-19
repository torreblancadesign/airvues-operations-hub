"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Story, COMMISSION_RATE } from "@/lib/engineering-types";
import { OrphanGroup } from "@/lib/orphan-triage-types";
import { bulkUpdateStories } from "@/lib/mutations/story";

type EngineerOption = { id: string; name: string };

type Props = {
  group: OrphanGroup;
  engineers: EngineerOption[];
  canEdit: boolean;
  onAssigned: () => void;
  onOpenStory: (s: Story) => void;
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

export function OrphanGroupCard({ group, engineers, canEdit, onAssigned, onOpenStory }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pickedEngineer, setPickedEngineer] = useState<string>(group.suggestedEngineerId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function apply() {
    if (!pickedEngineer) return;
    setError(null);
    startTransition(async () => {
      const result = await bulkUpdateStories(
        group.stories.map((s) => s.id),
        { assigneeIds: [pickedEngineer] },
      );
      if ("ok" in result) {
        setDone(true);
        onAssigned();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="bg-emerald/5 border border-emerald/30 rounded-card p-4 text-[12px] text-emerald font-mono">
        ✓ Assigned {group.stories.length} stories ({fmtMoney(group.totalInvoice)} scope) to{" "}
        {engineers.find((e) => e.id === pickedEngineer)?.name ?? "(engineer)"}.
      </div>
    );
  }

  const pickedName = engineers.find((e) => e.id === pickedEngineer)?.name;

  return (
    <div className="bg-surface border border-rule rounded-card overflow-hidden">
      <div className="px-5 py-4 border-b border-rule">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1">
              {group.quoteId ? "Quote group" : "No quote linked"}
              {group.status && <span className="ml-2">· {group.status}</span>}
            </div>
            <div className="text-[15px] font-semibold text-ink-strong leading-tight">
              {group.quoteLabel}
            </div>
            {group.client && (
              <div className="text-[12px] text-ink-muted mt-0.5">{group.client}</div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
              {group.stories.length} stories · {group.totalHours.toFixed(0)}h
            </div>
            <div className="text-[16px] font-semibold text-ink-strong tabnum">
              {fmtMoney(group.totalInvoice)}
            </div>
            <div className="text-[11px] font-mono text-emerald tabnum">
              {fmtMoney(group.totalCommission)} commission
            </div>
          </div>
        </div>

        {group.suggestedEngineerName && (
          <div className="text-[11px] text-ink-muted mt-1">
            Suggested:{" "}
            <span className="text-emerald font-semibold">{group.suggestedEngineerName}</span>{" "}
            (from Quote.Prepared by)
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-bg-elevated border-b border-rule">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-mono text-ink-muted hover:text-ink-strong transition-colors"
        >
          {expanded ? "▾ Hide" : "▸ Show"} {group.stories.length} stories
        </button>
        {expanded && (
          <div className="mt-3 space-y-1.5">
            {group.stories.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenStory(s)}
                className="w-full text-left flex items-center gap-2 text-[12px] hover:bg-surface px-2 py-1 rounded transition-colors group"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot(s.priority)}`} />
                <span className="text-ink-faint font-mono text-[10px] tabnum shrink-0">
                  #{s.storyNumber ?? "?"}
                </span>
                <span className="text-ink-strong group-hover:text-emerald transition-colors truncate flex-1">
                  {s.name}
                </span>
                <span className="text-ink-faint font-mono tabnum shrink-0">
                  {s.hours ?? "?"}h
                </span>
                <span className="text-ink-strong font-semibold tabnum shrink-0">
                  {fmtMoney(s.invoice)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
            Assign all to:
          </span>
          <select
            value={pickedEngineer}
            onChange={(e) => setPickedEngineer(e.target.value)}
            disabled={pending}
            className="px-2.5 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink-strong rounded-md focus:border-emerald focus:outline-none transition-colors cursor-pointer"
          >
            <option value="">— pick engineer —</option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={apply}
            disabled={pending || !pickedEngineer}
            className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Assigning…" : pickedName ? `Assign all to ${pickedName.split(" ")[0]}` : "Assign"}
          </button>
          {error && <span className="text-[11px] text-red font-mono">{error}</span>}
        </div>
      )}
    </div>
  );
}
