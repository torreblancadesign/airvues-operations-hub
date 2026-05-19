export type StageBucket =
  | "all"
  | "draft"
  | "sent"
  | "signed"
  | "paid"
  | "lost"
  | "auditing";

export type Filter = {
  search: string;
  stage: StageBucket;
  proposalType: "all" | "Airtable Solutions Proposal" | "Web Development Proposal" | "Airtable Solutions";
  client: string | null;
  preparedBy: string | null;
  from: string | null;
  to: string | null;
  stalledOnly: boolean; // only sent/awaiting > 14d
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
};

export type SortKey = "preparedDate" | "totalCost" | "client" | "status" | "autonumber" | "daysSinceSent";
export type SortDir = "asc" | "desc";

export type Sort = { key: SortKey; dir: SortDir };
export const DEFAULT_SORT: Sort = { key: "preparedDate", dir: "desc" };
