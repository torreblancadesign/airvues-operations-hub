"use client";

import { Story, COMMISSION_RATE } from "@/lib/engineering-types";

type Props = {
  story: Story;
  onClick: (s: Story) => void;
  selected?: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

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

export function StoryCard({ story, onClick, selected = false }: Props) {
  const pct = story.hours && story.hours > 0
    ? Math.min(100, Math.round(((story.hoursWorked ?? 0) / story.hours) * 100))
    : null;
  const over = pct != null && pct > 100;
  const sprintNum = story.sprintNumbers[0] ?? null;
  const client = story.clientNames[0] ?? null;

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
        <span className="ml-auto text-[12px] font-semibold text-ink-strong tabnum">
          {fmtMoney(story.invoice)}
        </span>
      </div>

      <div className="text-[13px] text-ink-strong font-medium leading-snug mb-2 line-clamp-2 group-hover:text-emerald transition-colors">
        {story.name}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted mb-2 flex-wrap">
        {client && <span className="truncate max-w-[140px]">{client}</span>}
        {client && sprintNum != null && <span className="text-ink-faint">·</span>}
        {sprintNum != null && <span className="font-mono">Sprint {sprintNum}</span>}
      </div>

      {pct != null && (
        <div className="mb-2">
          <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${over ? "bg-red" : "bg-emerald"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-mono text-ink-faint tabnum">
            <span>
              {story.hoursWorked ?? 0}h / {story.hours}h
            </span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-rule">
        <span className="text-[10px] text-ink-faint uppercase tracking-wider">
          {Math.round(COMMISSION_RATE * 100)}% commission
        </span>
        <span className="text-[12px] font-semibold text-emerald tabnum">
          {fmtMoney(story.commission)}
        </span>
      </div>
    </button>
  );
}
