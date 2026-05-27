// Client-safe types for the home activity feed.
export type ActivityKind =
  | "story_created"
  | "story_completed"
  | "invoice_paid"
  | "invoice_created"
  | "quote_created"
  | "quote_won"
  | "sprint_done"
  | "sprint_created";

export type ActivityEvent = {
  id: string;
  at: string; // ISO
  kind: ActivityKind;
  text: string;
  href: string;
};
