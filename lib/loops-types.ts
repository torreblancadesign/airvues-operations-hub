// Client-safe types for the Loops (internal screen recorder) feature.

export type LoopLinkKind = "client" | "quote" | "story" | "lead" | null;

export type Loop = {
  id: string;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string; // ISO
  durationSec: number;
  videoUrl: string;
  posterUrl: string | null;
  sizeMb: number | null;
  shareToken: string;
  viewCount: number;
  // Legacy single-link surface (first non-empty link wins).
  linkKind: LoopLinkKind;
  linkedId: string | null;
  linkedLabel: string | null;
  // Independent client + quote tags (both can be set).
  linkedClientId: string | null;
  linkedClientName: string | null;
  linkedQuoteId: string | null;
  linkedQuoteName: string | null;
  // AI analysis (populated asynchronously after upload).
  transcript: string | null;
  summary: string | null;
  keyNotes: string | null;
  actionItems: string | null;
  questions: string | null;
  debugStatus: string | null;
};

export type LoopCreateInput = {
  title: string;
  videoUrl: string;
  posterUrl: string | null;
  durationSec: number;
  sizeMb: number;
  // Independent links — either, both, or neither.
  linkedClientId: string | null;
  linkedQuoteId: string | null;
};
