// Plan catalog rules: which plans a client may be put on, how a plan name maps
// back to the legacy singleSelect, and what a valid plan looks like.
//
// PURE MODULE — no I/O, no "server-only" import. Keep it that way: the test
// suite imports it directly, and a transitive server-only import breaks every
// test in the run, not just this file's.

import type { RetainerPriority, RetainerTier } from "./retainer-types";

/**
 * The seven choices in Quotes."Retainer Selected Tier". That field is written
 * by the external quote app and may still be what renders the client's
 * document, so it is mirrored — but only when a plan name matches one of these.
 */
export const LEGACY_TIER_CHOICES = [
  "Bronze",
  "Silver",
  "Gold",
  "Premium",
  "Platinum",
  "Sapphire",
  "Diamond",
] as const;

export type LegacyTierChoice = (typeof LEGACY_TIER_CHOICES)[number];

/**
 * Plans this company may be placed on: active catalog plans first, then that
 * company's own active custom plans, each group by rank.
 *
 * A custom plan with no owning company is hidden from EVERY picker rather than
 * offered in all of them — the same fail-closed rule listRetainerAgreements
 * applies to an agreement with no Company link.
 */
export function plansAvailableFor(
  tiers: RetainerTier[],
  companyId: string | null,
): RetainerTier[] {
  const byRank = (a: RetainerTier, b: RetainerTier) => a.rank - b.rank;
  const active = tiers.filter((t) => t.active);
  const catalog = active.filter((t) => !t.custom).sort(byRank);
  const custom = companyId
    ? active.filter((t) => t.custom && t.customForCompanyId === companyId).sort(byRank)
    : [];
  return [...catalog, ...custom];
}

/**
 * The legacy singleSelect value for a plan name, or null when there is none.
 *
 * Null means "leave the legacy field alone" — never blank it. A stale tier name
 * is recoverable by a human; a blank one silently breaks whatever renders the
 * client-facing document.
 */
export function legacyTierChoiceFor(name: string): LegacyTierChoice | null {
  const trimmed = (name ?? "").trim();
  return (LEGACY_TIER_CHOICES as readonly string[]).includes(trimmed)
    ? (trimmed as LegacyTierChoice)
    : null;
}

export type PlanInput = {
  name: string;
  rank: number;
  includedHours: number | null;
  monthlyRate: number | null;
  slaHours: Record<RetainerPriority, number | null>;
  slaLabel?: string | null;
  maxUrgentPerMonth?: number | null;
  clientDescription?: string | null;
  custom: boolean;
  customForCompanyId: string | null;
};

/** Non-negative and finite, or absent. Returns an error string or null. */
function checkNonNegative(value: number | null | undefined, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return `${label} must be a number.`;
  if (value < 0) return `${label} cannot be negative.`;
  return null;
}

/** First problem with this plan, or null when it is valid. */
export function validatePlanInput(input: PlanInput): string | null {
  if (!input.name || input.name.trim() === "") return "Plan name is required.";

  const rate = checkNonNegative(input.monthlyRate, "Monthly rate");
  if (rate) return rate;

  const hours = checkNonNegative(input.includedHours, "Included hours");
  if (hours) return hours;

  const urgentCap = checkNonNegative(input.maxUrgentPerMonth, "Max urgent per month");
  if (urgentCap) return urgentCap;

  for (const priority of ["Urgent", "High", "Medium", "Low"] as RetainerPriority[]) {
    const sla = checkNonNegative(input.slaHours[priority], `SLA — ${priority}`);
    if (sla) return sla;
  }

  if (input.custom && !input.customForCompanyId) {
    return "A custom plan must name the client it belongs to.";
  }
  return null;
}
