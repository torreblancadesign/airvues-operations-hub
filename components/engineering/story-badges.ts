// Shared status/priority tone helpers for story list views.
export function statusTone(status: string | null): string {
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

export function priorityDot(p: string | null): string {
  switch (p) {
    case "Urgent": return "bg-red";
    case "High": return "bg-amber";
    case "Medium": return "bg-sky";
    case "Low": return "bg-ink-faint";
    default: return "";
  }
}
