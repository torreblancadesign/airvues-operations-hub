// Client-safe types for the Project Log timeline.
// Project Log table records lifecycle events for accounts/projects.

export type ProjectLogEventType =
  | "Lead created"
  | "Discovery notes added"
  | "Proposal sent"
  | "Proposal signed"
  | "Payment received"
  | "Deadline changed"
  | "Project status changed"
  | "Story created"
  | "Story completed"
  | "Invoice created"
  | "Partner status changed";

export type ProjectLogEntry = {
  id: string;
  accountId: string | null;
  projectId: string | null;
  eventType: string;
  timestamp: string; // ISO
  detail: string;
};
