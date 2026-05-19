export type BacklogFilter = {
  search: string;
  scope: "orphan" | "active" | "all" | "todo" | "in-progress" | "qa" | "done";
  engineerId: string | null;
  client: string | null;
  priority: string | null;
};

export const EMPTY_BACKLOG_FILTER: BacklogFilter = {
  search: "",
  scope: "orphan",
  engineerId: null,
  client: null,
  priority: null,
};

export const SCOPE_TO_STATUSES: Record<BacklogFilter["scope"], string[] | "*"> = {
  orphan: "*",
  active: ["Todo", "In progress", "QA Review", "Analysis Required"],
  all: "*",
  todo: ["Todo"],
  "in-progress": ["In progress"],
  qa: ["QA Review"],
  done: ["Completed"],
};
