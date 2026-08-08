// Server Actions for retainer agreements themselves.
//
// A retainer IS a ⚪️ Quotes row with Proposal Type = "Retainer Agreement".
// That is a deliberate modelling decision (spec 2026-08-08, D1): the quote is
// the signed paper and the live subscription at once, so there is nothing to
// migrate and the external quote app keeps working unchanged.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import { listRetainerTiers } from "../retainers";
import { legacyTierChoiceFor } from "../retainer-catalog";
import type { RetainerTier } from "../retainer-types";

const QUOTE = Tables.Quotes;

export type RetainerMutationResult<T = unknown> = ({ ok: true } & T) | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireRole("admin", "lead");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("retainers:agreements");
  revalidateTag("retainers:tiers");
}

/**
 * Fields for a plan linkage.
 *
 * THE LEGACY MIRROR LIVES HERE AND NOWHERE ELSE (spec D3). Quotes carries two
 * plan fields: the record link this feature uses, and "Retainer Selected Tier",
 * a singleSelect of seven fixed names written by the external quote app which
 * may still be what renders the client's document.
 *
 * The link is always written. The singleSelect is written only when the plan
 * name matches one of the seven. A custom plan has no matching choice, so the
 * legacy value is LEFT ALONE — never blanked. A stale name is recoverable by a
 * human; a blank one silently breaks the client-facing document.
 */
function planFields(tier: RetainerTier | null): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    "Retainer Tier": tier ? [tier.id] : [],
  };
  const legacy = tier ? legacyTierChoiceFor(tier.name) : null;
  if (legacy) fields["Retainer Selected Tier"] = legacy;
  return fields;
}

/** Resolve a plan id to a plan. Uncached — a stale read writes the wrong rate. */
async function tierById(tierId: string | null): Promise<RetainerTier | null> {
  if (!tierId) return null;
  const tiers = await listRetainerTiers({ fresh: true });
  return tiers.find((t) => t.id === tierId) ?? null;
}

export type RetainerInput = {
  projectName: string;
  companyId: string;
  tierId?: string | null;
  monthlyRate?: number | null;
  includedHours?: number | null;
  termMonths?: number | null;
  /** ISO date, e.g. "2026-06-16". Drives the anniversary period. */
  effectiveDate?: string | null;
  active: boolean;
};

function baseFields(input: Partial<RetainerInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.projectName !== undefined) f["Project Name"] = input.projectName.trim();
  if (input.companyId !== undefined) f["Company"] = input.companyId ? [input.companyId] : [];
  if (input.monthlyRate !== undefined) f["Retainer Selected Monthly Rate"] = input.monthlyRate;
  if (input.includedHours !== undefined) f["Retainer Selected Hours"] = input.includedHours;
  if (input.termMonths !== undefined) f["Retainer Initial Term Months"] = input.termMonths;
  if (input.effectiveDate !== undefined) f["Retainer Effective Date"] = input.effectiveDate;
  if (input.active !== undefined) {
    f["Retainer Subscription Active"] = input.active ? "Active" : "Cancelled";
  }
  return f;
}

function validate(input: Partial<RetainerInput>): string | null {
  if (input.projectName !== undefined && input.projectName.trim() === "") {
    return "Retainer name is required.";
  }
  if (input.companyId !== undefined && !input.companyId) {
    return "A client is required — it is what scopes the retainer.";
  }
  for (const [value, label] of [
    [input.monthlyRate, "Monthly rate"],
    [input.includedHours, "Included hours"],
    [input.termMonths, "Term months"],
  ] as [number | null | undefined, string][]) {
    if (value === null || value === undefined) continue;
    if (!Number.isFinite(value)) return `${label} must be a number.`;
    if (value < 0) return `${label} cannot be negative.`;
  }
  if (input.effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    return "Effective date must be YYYY-MM-DD.";
  }
  return null;
}

/**
 * Create a retainer agreement.
 *
 * companyId is REQUIRED. Company is the tenant key: listRetainerAgreements
 * drops any agreement without one, so a retainer created without a client
 * would be written and then be invisible to its own board row. Rejecting it at
 * the boundary is better than storing a record nobody can ever see.
 */
export async function createRetainer(
  input: RetainerInput,
): Promise<RetainerMutationResult<{ id: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const invalid = validate(input);
  if (invalid) return { error: invalid };
  if (!input.companyId) return { error: "A client is required." };

  try {
    const tier = await tierById(input.tierId ?? null);
    if (input.tierId && !tier) return { error: "That plan no longer exists." };

    const [created] = await createRecords(QUOTE.id, [
      {
        fields: {
          ...baseFields(input),
          ...planFields(tier),
          "Proposal Type": "Retainer Agreement",
        },
      },
    ]);
    invalidate();
    return { ok: true, id: created.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateRetainer(
  id: string,
  patch: Partial<RetainerInput> & { tierId?: string | null },
): Promise<RetainerMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  const invalid = validate(patch);
  if (invalid) return { error: invalid };

  try {
    const fields = baseFields(patch);

    // tierId undefined = "don't touch the plan". tierId null = "unlink it".
    if (patch.tierId !== undefined) {
      const tier = await tierById(patch.tierId);
      if (patch.tierId && !tier) return { error: "That plan no longer exists." };
      Object.assign(fields, planFields(tier));
    }

    if (Object.keys(fields).length === 0) return { ok: true };

    await patchRecords(QUOTE.id, [{ id, fields }]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
