export type StageBucket =
  | "all"
  | "draft"
  | "sent"
  | "signed"
  | "paid"
  | "lost"
  | "auditing";

// Active Proposal Type values in Airtable (post 2026-06 cleanup):
// "Airtable Solutions Proposal" and "Retainer Agreement". Legacy values
// ("Web Development Proposal", "Airtable Solutions") were removed.
export type ProposalType = "Airtable Solutions Proposal" | "Retainer Agreement";

export type DeadlineRisk = "ok" | "yellow" | "red" | "overdue";

export type Filter = {
  search: string;
  stage: StageBucket;
  proposalType: "all" | ProposalType;
  client: string | null;
  preparedBy: string | null;
  from: string | null;
  to: string | null;
  stalledOnly: boolean; // only sent/awaiting > 14d
  deadlineRisk: "all" | DeadlineRisk | "needs-attention"; // needs-attention = overdue|red|yellow
  showRejected: boolean; // rejected hidden by default per blueprint
};

export const EMPTY_FILTER: Filter = {
  search: "",
  stage: "all",
  proposalType: "all",
  client: null,
  preparedBy: null,
  from: null,
  to: null,
  stalledOnly: false,
  deadlineRisk: "all",
  showRejected: false,
};

export type SortKey = "preparedDate" | "totalCost" | "client" | "status" | "autonumber" | "daysSinceSent" | "uninvoiced" | "invoiced";
export type SortDir = "asc" | "desc";

export type Sort = { key: SortKey; dir: SortDir };
export const DEFAULT_SORT: Sort = { key: "preparedDate", dir: "desc" };
