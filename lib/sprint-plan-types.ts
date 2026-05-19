// Client-safe types for sprint planning.
import { Story } from "./engineering-types";

export type EngineerCapacity = {
  id: string;
  name: string;
  role: string | null;
  capacity: number;
  committedHours: number;
  committedStories: Story[];
  committedInvoice: number;
  committedCommission: number;
  utilizationPct: number;
};

export type SprintPlan = {
  sprintId: string;
  sprintNumber: number | null;
  sprintName: string;
  sprintStatus: string | null;
  sprintStart: string | null;
  sprintEnd: string | null;
  sprintGoals: string | null;
  engineers: EngineerCapacity[];
  backlog: Story[];
  totalCapacity: number;
  totalCommitted: number;
  totalFree: number;
  airtableUrl: string;
};

// Default capacity per engineer per sprint. TODO Phase D.5: per-engineer override
// via People.Weekly Capacity Hours field once schema lands.
export const DEFAULT_CAPACITY_HOURS = 80;
