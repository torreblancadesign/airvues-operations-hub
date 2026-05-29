// Client-safe types and constants for the engineering board.
// `lib/engineering.ts` is server-only (Airtable token); this file is shared.

export const COMMISSION_RATE = 0.15;

export type Story = {
  id: string;
  storyNumber: number | null;
  name: string;
  status: string | null;
  priority: string | null;
  phase: string | null;
  hours: number | null;
  hoursWorked: number | null;
  invoice: number;
  cost: number;
  commission: number;
  budgetPctUsed: number | null;
  assigneeIds: string[];
  assigneeNames: string[];
  clientIds: string[];
  clientNames: string[];
  quoteIds: string[];
  quoteLabels: string[];
  sprintIds: string[];
  sprintNumbers: number[];
  sprintStatuses: string[];
  sprintEnds: string[];
  completedDate: string | null;
  payStatus: string[];
  description: string;
  airtableUrl: string;
};

export type EngineerGroup = {
  id: string;
  name: string;
  role: string | null;
  internalType: string | null;
  isOrphan: boolean;
  stories: Story[];
  totals: {
    storyCount: number;
    activeCount: number;
    doneCount: number;
    inProgressCount: number;
    todoCount: number;
    onHoldCount: number;
    qaCount: number;
    activeHoursAssigned: number;
    activeHoursWorked: number;
    openInvoice: number;
    openCommission: number;
    earnedInvoice: number;
    earnedCommission: number;
  };
};

export type AssignablePerson = {
  id: string;
  name: string;
  role: string | null;
  internalType: string | null;
};

export type EngineeringBoardData = {
  groups: EngineerGroup[];
  assignablePeople: AssignablePerson[];
  totals: {
    totalStories: number;
    activeStories: number;
    orphanStories: number;
    completedStories: number;
    openInvoice: number;
    openCommission: number;
    earnedInvoice: number;
    earnedCommission: number;
    overBudgetCount: number;
    qaReviewCount: number;
    analysisRequiredCount: number;
  };
  clients: string[];
  sprints: { number: number; status: string | null }[];
  statuses: string[];
};

