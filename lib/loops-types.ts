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

/**
 * Vercel Blob serves `?download=1` with `Content-Disposition: attachment`, so the
 * transfer streams straight from the CDN instead of through a function. The saved
 * filename comes from the blob pathname, which already carries the loop title —
 * see LoopRecorder: `loops/{sessionId}/{sanitized-title}.webm`.
 */
export function loopDownloadUrl(videoUrl: string): string {
  if (!videoUrl) return "";
  try {
    const u = new URL(videoUrl);
    u.searchParams.set("download", "1");
    return u.toString();
  } catch {
    // Not an absolute URL (legacy row). Leave it alone rather than mangle it.
    return videoUrl;
  }
}

/** `4:12`, or `1:04:12` once a recording runs past the hour. */
export function formatLoopDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString();
  return `${h > 0 ? `${h}:` : ""}${mm}:${sec.toString().padStart(2, "0")}`;
}

/**
 * `Aug 4`, or `Aug 4, 2025` once the year differs from `now`.
 *
 * Call this on the server and pass the string down. Formatting a date inside a
 * client component desyncs hydration — the server and the browser disagree on
 * both locale and timezone, which is exactly what the card grid used to do.
 */
export function formatLoopDate(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export type LoopAnalysisState = "ready" | "pending" | "failed";

/**
 * Where a loop sits in the AI pipeline. `Debug Status` is written exactly once,
 * when analysis settles — `[iso] OK | …` or `[iso] FAILED | …` — so an empty
 * status with no content means the job is still in flight.
 */
export function loopAnalysisState(
  loop: Pick<Loop, "summary" | "transcript" | "debugStatus">,
): LoopAnalysisState {
  if (loop.summary?.trim() || loop.transcript?.trim()) return "ready";
  if (loop.debugStatus && /\]\s*FAILED\b/.test(loop.debugStatus)) return "failed";
  return "pending";
}

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
