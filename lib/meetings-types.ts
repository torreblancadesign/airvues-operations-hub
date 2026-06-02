// Client-safe types for the Meetings (meeting recorder + AI note-taker) feature.

export type MeetingStatus = "Processing" | "Ready" | "Failed";
export type MeetingSource = "meet" | "zoom" | "manual" | "other";

export type Meeting = {
  id: string;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string; // ISO
  durationSec: number;
  audioUrl: string;
  sizeMb: number | null;
  source: MeetingSource;
  status: MeetingStatus;
  linkedLeadId: string | null;
  linkedLeadName: string | null;
  transcript: string | null;
  summary: string | null;
  keyDecisions: string | null;
  actionItems: string | null;
  questions: string | null;
};

export type MeetingCreateInput = {
  title: string;
  audioUrl: string;
  durationSec: number;
  sizeMb: number;
  source: MeetingSource;
  linkedLeadId: string | null;
};
