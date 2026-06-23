// Client-safe types for the Pipeline quote drawer editor.

export type QuoteStoryRow = {
  id: string;
  name: string;
  description: string;
  hours: number | null;
  cost: number | null;
  clientNotes: string;
  status: string | null;
  assignees: { id: string; name: string }[];
  isChangeOrder: boolean;
};

export type QuoteAttachment = {
  id: string;
  filename: string;
  url: string;
  type: string | null;
  size: number | null;
};

export type QuoteDetail = {
  id: string;
  // Header (client-visible)
  projectName: string;
  preparedById: string | null;
  preparedByName: string | null;
  preparedDate: string | null;
  deliveryDueDate: string | null;
  preparedForId: string | null;
  preparedForName: string | null;
  projectStatus: string | null;
  proposalType: string | null;
  status: string | null;
  epicOwnerId: string | null;
  epicOwnerName: string | null;
  // Client input (internal)
  customProblemStatement: string;
  documents: QuoteAttachment[];
  // AI proposal output (client-visible)
  recommendedApproach: string;
  recommendedApproachSummary: string;
  projectOverview: string;
  problemStatementSolution: string;
  estimateHoursRange: string;
  estimateCostRange: string;
  // AI automation trigger (checkbox)
  runAiProposalAgent: boolean;
  // AI change order automation trigger (checkbox)
  runAiChangeOrderAgent: boolean;
  // Sales: marks this quote as a Blueprint engagement (+5% commission bonus
  // to the Prepared by salesperson)
  blueprint: boolean;
  // Change orders (long-text block of details + flagged stories)
  changeOrderDetails: string;
  // Estimated cost range string for the change orders (client-visible)
  changeOrderEstimateCost: string;
  // Raw input passed to the AI agent that drafts the change order summary + stories
  changeOrderInputDetails: string;
  // Stories + totals
  stories: QuoteStoryRow[];
  totalCost: number;
  totalHours: number | null;
  // Partitioned totals (computed from stories[])
  originalTotalCost: number;
  originalTotalHours: number | null;
  changeOrderTotalCost: number;
  changeOrderTotalHours: number | null;
};

export type PersonOption = { id: string; name: string; email: string | null; isInternal: boolean; isActive: boolean };

export const PROJECT_STATUS_CHOICES = [
  "Proposal Created",
  "Proposal Accepted",
  "Proposal Signed",
  "Commencement Invoice Paid",
  "First Draft Delivered",
  "Project Accepted",
  "Completion Invoice Paid",
] as const;

// Active Proposal Type values in Airtable (post 2026-06 cleanup).
// Legacy values ("Web Development Proposal", "Airtable Solutions") were removed.
export const PROPOSAL_TYPE_CHOICES = [
  "Airtable Solutions Proposal",
  "Retainer Agreement",
] as const;

export type QuoteFieldPatch = Partial<{
  projectName: string;
  preparedById: string | null;
  preparedDate: string | null;
  deliveryDueDate: string | null;
  preparedForId: string | null;
  projectStatus: string | null;
  proposalType: string | null;
  customProblemStatement: string;
  recommendedApproach: string;
  recommendedApproachSummary: string;
  projectOverview: string;
  problemStatementSolution: string;
  estimateHoursRange: string;
  estimateCostRange: string;
  blueprint: boolean;
  epicOwnerId: string | null;
  changeOrderDetails: string;
  changeOrderInputDetails: string;
  changeOrderEstimateCost?: string;
}>;
