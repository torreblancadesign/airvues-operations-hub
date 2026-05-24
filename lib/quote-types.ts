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
  preparedForId: string | null;
  preparedForName: string | null;
  projectStatus: string | null;
  proposalType: string | null;
  status: string | null;
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
  // Stories + totals
  stories: QuoteStoryRow[];
  totalCost: number;
  totalHours: number | null;
};

export type PersonOption = { id: string; name: string; email: string | null; isInternal: boolean };

export const PROJECT_STATUS_CHOICES = [
  "Proposal Created",
  "Proposal Accepted",
  "Proposal Signed",
  "Commencement Invoice Paid",
  "First Draft Delivered",
  "Project Accepted",
  "Completion Invoice Paid",
] as const;

export const PROPOSAL_TYPE_CHOICES = [
  "Airtable Solutions Proposal",
  "Web Development Proposal",
  "Airtable Solutions",
] as const;

export type QuoteFieldPatch = Partial<{
  projectName: string;
  preparedById: string | null;
  preparedDate: string | null;
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
}>;
