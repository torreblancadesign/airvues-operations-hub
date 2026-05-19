// Filter state shared between FilterBar, InvoiceTable, and MoneyDashboard.

export type StatusBucket = "all" | "paid" | "open" | "overdue" | "subscribed" | "void";

export type Filter = {
  search: string;
  status: StatusBucket;
  source: "all" | "Stripe" | "Fiverr" | "Other";
  type: "all" | "One-time" | "Recurring" | "Payment Plan";
  payer: string | null;     // null = any payer
  from: string | null;      // ISO date "YYYY-MM-DD"
  to: string | null;        // ISO date "YYYY-MM-DD"
};

export const EMPTY_FILTER: Filter = {
  search: "",
  status: "all",
  source: "all",
  type: "all",
  payer: null,
  from: null,
  to: null,
};

export type SortKey = "date" | "amount" | "payer" | "status" | "invoiceId";
export type SortDir = "asc" | "desc";

export type Sort = {
  key: SortKey;
  dir: SortDir;
};

export const DEFAULT_SORT: Sort = { key: "date", dir: "desc" };
