// Client-safe types for orphan-stories triage.
import { Story } from "./engineering-types";

export type OrphanGroup = {
  groupKey: string;
  quoteId: string | null;
  quoteLabel: string;
  client: string | null;
  status: string | null;
  suggestedEngineerId: string | null;
  suggestedEngineerName: string | null;
  stories: Story[];
  totalInvoice: number;
  totalHours: number;
  totalCommission: number;
};

export type OrphanTriageData = {
  totalOrphans: number;
  totalInvoice: number;
  totalCommission: number;
  groups: OrphanGroup[];
  engineers: { id: string; name: string }[];
  ungroupedCount: number;
};
