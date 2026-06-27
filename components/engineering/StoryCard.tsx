"use client";

import { Story } from "@/lib/engineering-types";
import { statusProgressPct, statusProgressTone } from "@/lib/story-progress";

type Props = {
  story: Story;
  onClick: (s: Story) => void;
  selected?: boolean;
};

function statusTone(status: string | null): string {
  switch (status) {
    case "In progress": return "bg-emerald/15 text-emerald border-emerald/30";
    case "Todo": return "bg-bg-elevated text-ink-muted border-rule";
    case "QA Review": return "bg-sky/15 text-sky border-sky/30";
    case "Completed": return "bg-violet/15 text-violet border-violet/30";
    case "On Hold": return "bg-amber/15 text-amber border-amber/30";
    case "Incomplete": return "bg-red/15 text-red border-red/30";
    case "Analysis Required": return "bg-amber/15 text-amber border-amber/30";
    default: return "bg-bg-elevated text-ink-muted border-rule";
  }
}

function priorityDot(p: string | null): string {
  switch (p) {
    case "Urgent": return "bg-red";
    case "High": return "bg-amber";
    case "Medium": return "bg-sky";
    case "Low": return "bg-ink-faint";
    default: return "";
  }
}

function payStatusTone(s: string): string {
  const v = s.toLowerCase();
  if (v.includes("paid") && !v.includes("partial") && !v.includes("unpaid")) return "bg-emerald/15 text-emerald border-emerald/30";
  if (v.includes("partial") || v.includes("deposit")) return "bg-amber/15 text-amber border-amber/30";
  if (v.includes("unpaid") || v.includes("overdue") || v.includes("past due")) return "bg-red/15 text-red border-red/30";
  return "bg-bg-elevated text-ink-muted border-rule";
}

export function StoryCard({ story, onClick, selected = false }: Props) {
  // Progress is driven by Story Status (0/50/100 per blueprint), not by hours.
  // Hours are still shown — actual as the primary number, estimated as a muted reference.
  const progressPct = statusProgressPct(story.status);
  const progressTone = statusProgressTone(story.status);
  const actual = story.hoursWorked ?? null;
  const estimated = story.hours ?? null;
  const sprintNum = story.sprintNumbers[0] ?? null;
  const client = story.clientNames[0] ?? null;
  const quoteLabel = story.quoteLabels[0] ?? null;

  return (
    <button
      type="button"
      onClick={() => onClick(story)}
      className={`w-full text-left bg-surface border rounded-md p-3 transition-all hover:border-rule-strong group ${
        selected ? "border-emerald ring-1 ring-emerald/30" : "border-rule"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {story.priority && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot(story.priority)}`} aria-label={story.priority} />
        )}
        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusTone(story.status)}`}>
          {story.status ?? "—"}
        </span>
        {story.storyNumber != null && (
          <span className="text-[10px] font-mono text-ink-faint">#{story.storyNumber}</span>
        )}
        {actual != null ? (
          <span className="ml-auto text-[11px] font-mono text-ink-strong tabnum" title="Actual hours worked">
            {actual}h
            {estimated != null && (
              <span className="text-ink-faint font-normal"> / {estimated}h est</span>
            )}
          </span>
        ) : estimated != null ? (
          <span className="ml-auto text-[11px] font-mono text-ink-muted tabnum" title="Estimated hours">
            {estimated}h est
          </span>
        ) : null}
      </div>

      <div className="text-[13px] text-ink-strong font-medium leading-snug mb-1.5 line-clamp-2 group-hover:text-emerald transition-colors">
        {story.name}
      </div>

      {client && (
        <div className="text-[11px] text-ink-strong mb-1 truncate" title={client}>
          <span className="text-ink-faint font-mono uppercase tracking-wider text-[10px] mr-1">Client</span>
          {client}
        </div>
      )}

      {quoteLabel && (
        <div className="text-[11px] text-ink-muted mb-1.5 truncate" title={quoteLabel}>
          <span className="text-ink-faint font-mono uppercase tracking-wider text-[10px] mr-1">Quote</span>
          {quoteLabel}
        </div>
      )}

      {(story.payStatus[0] || story.taskPayStatus.length > 0) && (
        <div className="mb-1.5 flex items-center gap-1 flex-wrap">
          {story.payStatus[0] && (
            <span
              className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${payStatusTone(story.payStatus[0])}`}
              title={story.payStatus.join(", ")}
            >
              Pay · {story.payStatus[0]}
            </span>
          )}
          {story.taskPayStatus.length > 0 && (() => {
            const allPaid = story.taskPayStatus.every((v) => v === "Paid");
            const anyNeeds = story.taskPayStatus.some((v) => v === "Needs Payment");
            const label = allPaid ? "Paid" : anyNeeds ? "Awaiting" : story.taskPayStatus[0];
            const tone = allPaid
              ? "bg-emerald/15 text-emerald border-emerald/30"
              : anyNeeds
                ? "bg-amber/15 text-amber border-amber/30"
                : "bg-bg-elevated text-ink-muted border-rule";
            return (
              <span
                className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${tone}`}
                title={`Payout · ${story.taskPayStatus.join(", ")}`}
              >
                Payout · {label}
              </span>
            );
          })()}
        </div>
      )}

      {sprintNum != null && (
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted mb-2 flex-wrap">
          <span className="font-mono">Sprint {sprintNum}</span>
        </div>
      )}

      {story.description && (
        <div className="text-[11px] text-ink-muted leading-snug mb-2 line-clamp-2 whitespace-pre-wrap">
          {story.description}
        </div>
      )}

      <div className="pt-2 border-t border-rule">
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressTone}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-mono text-ink-faint tabnum">
          <span>
            {actual != null ? `${actual}h worked` : "0h worked"}
            {estimated != null ? ` · ${estimated}h est` : ""}
          </span>
          <span>{progressPct}%</span>
        </div>
      </div>
    </button>
  );
}
