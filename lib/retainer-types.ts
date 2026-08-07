// Client-safe retainer types. No "server-only" — imported by client components.

export const RETAINER_PRIORITIES = ["Urgent", "High", "Medium", "Low"] as const;
export type RetainerPriority = (typeof RETAINER_PRIORITIES)[number];

export const SLA_OUTCOMES = ["Pending", "Met", "Breached", "Not covered"] as const;
export type SlaOutcome = (typeof SLA_OUTCOMES)[number];

/** Client-facing request statuses. Deliberately distinct from Story Status. */
export const REQUEST_STATUSES = [
  "Submitted",
  "Acknowledged",
  "In Progress",
  "Awaiting Client",
  "Delivered",
  "Closed",
  "Declined",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RetainerTier = {
  id: string;
  name: string;
  rank: number;
  active: boolean;
  includedHours: number | null;
  monthlyRate: number | null;
  /** Business hours to first response, per priority. null = not covered. */
  slaHours: Record<RetainerPriority, number | null>;
  slaLabel: string | null;
  maxUrgentPerMonth: number | null;
  clientDescription: string | null;
};
