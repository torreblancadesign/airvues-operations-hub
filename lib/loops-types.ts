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
  linkKind: LoopLinkKind;
  linkedId: string | null;
  linkedLabel: string | null;
};

export type LoopCreateInput = {
  title: string;
  videoUrl: string;
  posterUrl: string | null;
  durationSec: number;
  sizeMb: number;
  linkKind: LoopLinkKind;
  linkedId: string | null;
};
