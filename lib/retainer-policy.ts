// Maps a retainer tier + client priority to an SLA deadline and outcome.
//
// PURE MODULE — no I/O. Duplicated into airvues-retainer-portal alongside
// lib/retainer-sla.ts.
//
// Degradation rule: no tier, or a blank SLA column, yields "Not covered".
// "Not covered" MUST NEVER become "Breached" — that is what allows the portal
// to ship before management has filled the tier table.

import { addBusinessHours, businessHoursBetween } from "./retainer-sla";
import type { RetainerPriority, RetainerTier, SlaOutcome } from "./retainer-types";

/** Business hours allowed for this priority, or null if not covered. */
export function slaHoursFor(tier: RetainerTier | null, priority: RetainerPriority): number | null {
  if (!tier) return null;
  const h = tier.slaHours[priority];
  return typeof h === "number" && h > 0 ? h : null;
}

/** Deadline for a first human response, or null when not covered. */
export function computeSlaDueAt(
  tier: RetainerTier | null,
  priority: RetainerPriority,
  submittedAt: Date,
): Date | null {
  const hours = slaHoursFor(tier, priority);
  if (hours === null) return null;
  return addBusinessHours(submittedAt, hours);
}

export function evaluateSlaOutcome(args: {
  dueAt: Date | null;
  firstRespondedAt: Date | null;
  now: Date;
}): SlaOutcome {
  const { dueAt, firstRespondedAt, now } = args;
  if (!dueAt) return "Not covered";
  if (firstRespondedAt) return firstRespondedAt <= dueAt ? "Met" : "Breached";
  return now > dueAt ? "Breached" : "Pending";
}

/**
 * How much of the SLA window has elapsed, 0..1. Used to flag "at risk"
 * (>= 0.75) on the manager board. null when not covered.
 */
export function slaRiskRatio(args: {
  submittedAt: Date;
  dueAt: Date | null;
  now: Date;
}): number | null {
  const { submittedAt, dueAt, now } = args;
  if (!dueAt) return null;
  const total = businessHoursBetween(submittedAt, dueAt);
  if (total <= 0) return 1;
  const elapsed = businessHoursBetween(submittedAt, now);
  return Math.min(1, elapsed / total);
}
