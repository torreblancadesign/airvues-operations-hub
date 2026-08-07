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

/** A client-submitted retainer request. Dates are ISO strings (client-safe). */
export type RetainerRequest = {
  id: string;
  title: string;
  retainerId: string | null;
  companyId: string | null;
  submittedById: string | null;
  priority: RetainerPriority | null;
  status: RequestStatus | null;
  submittedAt: string | null;
  slaDueAt: string | null;
  firstRespondedAt: string | null;
  slaOutcome: SlaOutcome | null;
  assignedToId: string | null;
  storyIds: string[];
  closedAt: string | null;
};

/** One row of the /retainers health board. */
export type RetainerBoardRow = {
  retainerId: string;
  projectName: string;
  companyId: string | null;
  companyName: string | null;
  tierName: string | null;
  slaLabel: string | null;
  subscriptionActive: boolean;
  /** Requests not yet Closed or Declined. */
  openCount: number;
  /** Open, unanswered, and past their deadline. */
  breachedNowCount: number;
  /** Open, unanswered, >=75% of the window elapsed, not yet breached. */
  atRiskCount: number;
  /** Breached at any point during the current period, answered or not. */
  breachedThisPeriodCount: number;
  /** Business hours the oldest unanswered open request has been waiting. */
  oldestUnansweredHours: number | null;
  includedHours: number | null;
  /** Sum of Stories.Hours completed inside the current period. May lag. */
  hoursLoggedThisPeriod: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** Sort key: higher is worse. Breaches dominate, then risk, then wait time. */
  severity: number;
};

/** Open statuses — everything except the two terminal ones. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  "Submitted",
  "Acknowledged",
  "In Progress",
  "Awaiting Client",
  "Delivered",
];
