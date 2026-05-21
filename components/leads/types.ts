import type { LeadStatus, LeadBudget, LeadSource } from "@/lib/leads";

export type Filter = {
  search: string;
  status: LeadStatus | "all";
  source: LeadSource | "all";
  budget: LeadBudget | "all";
  from: string | null;
  to: string | null;
  staleOnly: boolean;
};

export const EMPTY_FILTER: Filter = {
  search: "",
  status: "all",
  source: "all",
  budget: "all",
  from: null,
  to: null,
  staleOnly: false,
};

export type SortKey = "createdTime" | "name" | "company" | "meetingDate" | "status";
export type SortDir = "asc" | "desc";
export type Sort = { key: SortKey; dir: SortDir };
export const DEFAULT_SORT: Sort = { key: "createdTime", dir: "desc" };

export type Window = "ytd" | "mtd";

export const STATUS_ORDER: LeadStatus[] = [
  "New Lead",
  "Needs Review",
  "In Proposal Stage",
  "Sold",
  "Not Sold",
];

export const STATUS_PILL: Record<LeadStatus, string> = {
  "New Lead": "bg-sky-soft text-sky",
  "Needs Review": "bg-rule text-ink-muted",
  "In Proposal Stage": "bg-amber-soft text-amber",
  "Sold": "bg-emerald-soft text-emerald",
  "Not Sold": "bg-red-soft text-red",
};
