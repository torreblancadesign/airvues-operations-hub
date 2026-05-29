"use client";

import { Story } from "@/lib/engineering-types";

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
  const pct = story.hours && story.hours > 0
    ? Math.min(999, Math.round(((story.hoursWorked ?? 0) / story.hours) * 100))
    : null;
  const over = pct != null && pct > 100;
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
        {story.hours != null && (
          <span className="ml-auto text-[11px] font-mono text-ink-muted tabnum">
            {story.hours}h
          </span>
        )}
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

      {pct != null && (
        <div className="pt-2 border-t border-rule">
          <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${over ? "bg-red" : "bg-emerald"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-mono text-ink-faint tabnum">
            <span>
              {story.hoursWorked ?? 0}h worked / {story.hours}h scoped
            </span>
            <span className={over ? "text-red" : ""}>{pct}%</span>
          </div>
        </div>
      )}
    </button>
  );
}
