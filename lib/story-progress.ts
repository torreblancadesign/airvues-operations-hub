// Status-driven story progress per the Airvues One blueprint (2026-06).
// Progress is NOT derived from hours — it's a pure function of Story Status.
// Hours are still tracked separately for context (estimated vs actual).
//
// Mapping (per spec § 9.2 + explicit guidance for additional statuses):
//   Todo               → 0
//   Analysis Required  → 0
//   In progress        → 50
//   QA Review          → 50
//   On Hold            → 50
//   Incomplete         → 50
//   Completed          → 100
//   Archived           → 100

export type StoryStatus =
  | "Todo"
  | "In progress"
  | "QA Review"
  | "Completed"
  | "On Hold"
  | "Incomplete"
  | "Analysis Required"
  | "Archived";

export function statusProgressPct(status: string | null | undefined): number {
  switch (status) {
    case "Completed":
    case "Archived":
      return 100;
    case "In progress":
    case "QA Review":
    case "On Hold":
    case "Incomplete":
      return 50;
    case "Todo":
    case "Analysis Required":
    default:
      return 0;
  }
}

// Tailwind class for the progress bar fill — semantic, not literal color.
export function statusProgressTone(status: string | null | undefined): string {
  switch (status) {
    case "Completed":
    case "Archived":
      return "bg-emerald";
    case "QA Review":
      return "bg-sky";
    case "On Hold":
    case "Analysis Required":
      return "bg-amber";
    case "Incomplete":
      return "bg-red";
    case "In progress":
      return "bg-emerald/70";
    case "Todo":
    default:
      return "bg-ink-faint/40";
  }
}
