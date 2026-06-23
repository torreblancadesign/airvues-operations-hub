// Shared deadline-risk helper for projects (Client Delivery Due Date).
// Used by the projects/pipeline list, KPI tiles, and any "needs attention" view.

import type { DeadlineRisk } from "@/components/pipeline/types";

export function computeDeadlineRisk(dueIso: string | null | undefined): DeadlineRisk {
  if (!dueIso) return "ok";
  const due = new Date(dueIso).getTime();
  if (!isFinite(due)) return "ok";
  const days = Math.floor((due - Date.now()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "red";
  if (days <= 7) return "yellow";
  return "ok";
}

export function deadlineRiskLabel(risk: DeadlineRisk, dueIso: string | null | undefined): string {
  if (!dueIso) return "No deadline";
  const days = Math.floor((new Date(dueIso).getTime() - Date.now()) / 86_400_000);
  switch (risk) {
    case "overdue":
      return `Overdue by ${Math.abs(days)}d`;
    case "red":
      return days === 0 ? "Due today" : `${days}d left`;
    case "yellow":
      return `${days}d left`;
    default:
      return `${days}d left`;
  }
}

export function deadlineRiskClass(risk: DeadlineRisk): string {
  switch (risk) {
    case "overdue":
      return "bg-red-soft text-red";
    case "red":
      return "bg-red-soft text-red";
    case "yellow":
      return "bg-amber-soft text-amber";
    default:
      return "bg-rule text-ink-muted";
  }
}

export const NEEDS_ATTENTION_RISKS: DeadlineRisk[] = ["overdue", "red", "yellow"];
