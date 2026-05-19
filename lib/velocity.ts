// Velocity aggregator — computes multi-sprint stats from SprintSummary list.
// Used on /sprints index to show "how fast is the team moving" at a glance.
import "server-only";

import { SprintSummary } from "./sprints-types";

export type VelocityStats = {
  doneSprintCount: number;
  recentSprints: SprintSummary[]; // most recent N done sprints, oldest first (for charting)
  avgCompletionPct: number;
  avgDeliveredInvoice: number;
  avgStoriesPerSprint: number;
  avgHoursPerSprint: number;
  trendDirection: "up" | "down" | "flat" | "insufficient";
  trendDelta: number; // delta of completion % vs prior window
  bestSprint: SprintSummary | null;
  worstSprint: SprintSummary | null;
};

const WINDOW = 6; // last 6 done sprints for the aggregate

export function computeVelocity(allSprints: SprintSummary[]): VelocityStats {
  // Filter to Done sprints sorted by Sprint Number ascending
  const done = allSprints
    .filter((s) => s.status === "Done" && s.number != null)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  if (done.length === 0) {
    return {
      doneSprintCount: 0,
      recentSprints: [],
      avgCompletionPct: 0,
      avgDeliveredInvoice: 0,
      avgStoriesPerSprint: 0,
      avgHoursPerSprint: 0,
      trendDirection: "insufficient",
      trendDelta: 0,
      bestSprint: null,
      worstSprint: null,
    };
  }

  // Recent N (or all if fewer)
  const recent = done.slice(-WINDOW);
  // For chart display we want a wider window — show up to 12
  const chartWindow = done.slice(-12);

  let sumCompletion = 0;
  let sumInvoice = 0;
  let sumStories = 0;
  let sumHours = 0;
  for (const s of recent) {
    sumCompletion += s.completionPct;
    // delivered invoice = invoice * completionPct (proportional)
    sumInvoice += s.invoice * (s.completionPct / 100);
    sumStories += s.doneCount;
    sumHours += s.hoursScoped;
  }
  const n = recent.length;
  const avgCompletionPct = n > 0 ? sumCompletion / n : 0;
  const avgDeliveredInvoice = n > 0 ? sumInvoice / n : 0;
  const avgStoriesPerSprint = n > 0 ? sumStories / n : 0;
  const avgHoursPerSprint = n > 0 ? sumHours / n : 0;

  // Trend: compare avg of last 3 vs prior 3 (only if we have 6+ done sprints)
  let trendDirection: VelocityStats["trendDirection"] = "insufficient";
  let trendDelta = 0;
  if (done.length >= 6) {
    const recent3 = done.slice(-3);
    const prior3 = done.slice(-6, -3);
    const avg = (arr: SprintSummary[]) =>
      arr.reduce((s, x) => s + x.completionPct, 0) / arr.length;
    const recentAvg = avg(recent3);
    const priorAvg = avg(prior3);
    trendDelta = recentAvg - priorAvg;
    if (Math.abs(trendDelta) < 5) trendDirection = "flat";
    else if (trendDelta > 0) trendDirection = "up";
    else trendDirection = "down";
  }

  // Best + worst sprint by completion within the window we care about (all done)
  let bestSprint: SprintSummary | null = null;
  let worstSprint: SprintSummary | null = null;
  for (const s of done) {
    if (s.storyCount === 0) continue; // skip empty sprints
    if (!bestSprint || s.completionPct > bestSprint.completionPct) bestSprint = s;
    if (!worstSprint || s.completionPct < worstSprint.completionPct) worstSprint = s;
  }

  return {
    doneSprintCount: done.length,
    recentSprints: chartWindow,
    avgCompletionPct,
    avgDeliveredInvoice,
    avgStoriesPerSprint,
    avgHoursPerSprint,
    trendDirection,
    trendDelta,
    bestSprint,
    worstSprint,
  };
}
