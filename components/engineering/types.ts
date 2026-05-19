export type StatusBucket =
  | "all"
  | "active"
  | "todo"
  | "in-progress"
  | "qa"
  | "done"
  | "hold";

export type Filter = {
  search: string;
  status: StatusBucket;
  engineerId: string | null;
  client: string | null;
  sprintNumber: number | null;
  orphanOnly: boolean;
};

export const EMPTY_FILTER: Filter = {
  search: "",
  status: "active",
  engineerId: null,
  client: null,
  sprintNumber: null,
  orphanOnly: false,
};

export const STATUS_GROUPS: Record<StatusBucket, string[] | "*"> = {
  all: "*",
  active: ["Todo", "In progress", "QA Review", "Analysis Required"],
  todo: ["Todo"],
  "in-progress": ["In progress"],
  qa: ["QA Review"],
  done: ["Completed"],
  hold: ["On Hold", "Incomplete"],
};
