// Client-safe types for sprint planning.
import { Story } from "./engineering-types";

export type EngineerCapacity = {
  id: string;
  name: string;
  role: string | null;
  capacity: number;
  hasCapacityOverride: boolean;
  committedHours: number;
  committedStories: Story[];
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
  pool: Story[];
  totalCapacity: number;
  totalCommitted: number;
  totalFree: number;
  airtableUrl: string;
};

// Default capacity per engineer per sprint when no override row exists in
// the 🟢 Sprint Capacity table.
export const DEFAULT_CAPACITY_HOURS = 80;
