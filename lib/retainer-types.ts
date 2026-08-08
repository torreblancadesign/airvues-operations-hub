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
  /** True = a negotiated plan for one client, hidden from the general catalog. */
  custom: boolean;
  /** The Company this custom plan belongs to. null on catalog plans. */
  customForCompanyId: string | null;
  includedHours: number | null;
  monthlyRate: number | null;
  /** Business hours to first response, per priority. null = not covered. */
  slaHours: Record<RetainerPriority, number | null>;
  slaLabel: string | null;
  maxUrgentPerMonth: number | null;
  clientDescription: string | null;
};

/** A Retainer Agreement quote. Lives here, not in the server-only reader, so
 *  pure modules and client components can use the type. */
export type RetainerAgreement = {
  id: string;
  projectName: string;
  companyId: string | null;
  /** Companies.Name resolved via the Company link — the real org, e.g. "Gracie Barra". */
  companyName: string | null;
  /** The Prepared-for contact, e.g. "Flavio Almeida". Not the company. */
  contactName: string | null;
  tierId: string | null;
  monthlyRate: number | null;
  includedHours: number | null;
  termMonths: number | null;
  effectiveDate: string | null;
  subscriptionActive: boolean;
  /** Hidden from the board. Nothing is deleted; requests and stories stay linked.
   *  Distinct from subscriptionActive, which is the subscription's own state. */
  archived: boolean;
  dealStatus: string | null;
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

export type CommentSide = "Client" | "Airvues";

/** One message on a retainer request thread. */
export type RetainerComment = {
  id: string;
  requestId: string | null;
  authorId: string | null;
  authorName: string | null;
  authorSide: CommentSide | null;
  body: string;
  createdAt: string | null;
  /** Airvues comments with this false are internal-only and hidden from the portal. */
  visibleToClient: boolean;
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
  /** Hidden from the board unless "Show archived" is on. */
  archived: boolean;
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
