// Client-safe types for sprint views.
import { Story } from "./engineering-types";

export type SprintStatus = "In Progress" | "Done" | "Next" | null;

export type SprintSummary = {
  id: string;
  number: number | null;
  name: string;
  status: SprintStatus;
  start: string | null;
  end: string | null;
  goals: string | null;
  storyCount: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  qaCount: number;
  hoursScoped: number;
  hoursWorked: number;
  invoice: number;
  commission: number;
  completionPct: number;
  airtableUrl: string;
};

export type SprintDetail = SprintSummary & {
  stories: Story[];
};

export const KANBAN_COLUMNS = ["Todo", "In progress", "QA Review", "Completed"] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

// Workflow: which status comes next when you advance?
export const NEXT_STATUS: Record<KanbanColumn, KanbanColumn | null> = {
  Todo: "In progress",
  "In progress": "QA Review",
  "QA Review": "Completed",
  Completed: null,
};
