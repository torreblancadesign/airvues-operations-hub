// Server Actions for the retainer plan catalog.
//
// Stricter than lib/mutations/retainer-request.ts on purpose: that file gates
// on requireSignedIn() because clients must be able to file their own requests.
// Nobody outside admin/lead may touch a plan's pricing or its SLA promises.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import { listRetainerAgreements, listRetainerTiers } from "../retainers";
import { listRetainerRequests } from "../retainer-requests";
import { computeSlaDueAt, evaluateSlaOutcome } from "../retainer-policy";
import { requestsNeedingSlaRecompute } from "../retainer-board";
import { validatePlanInput, type PlanInput } from "../retainer-catalog";
import type { RetainerPriority } from "../retainer-types";

const TIER = Tables.RetainerTiers;
const REQ = Tables.RetainerRequests;

export type PlanMutationResult<T = unknown> = ({ ok: true } & T) | { error: string };

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
  revalidateTag("retainers:tiers");
}

const PRIORITIES: RetainerPriority[] = ["Urgent", "High", "Medium", "Low"];

const SLA_FIELD: Record<RetainerPriority, string> = {
  Urgent: "SLA — Urgent (business hrs)",
  High: "SLA — High (business hrs)",
  Medium: "SLA — Medium (business hrs)",
  Low: "SLA — Low (business hrs)",
};

/** PlanInput -> Airtable field payload. Undefined keys are left untouched. */
function planFields(patch: Partial<PlanInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (patch.name !== undefined) f["Tier Name"] = patch.name.trim();
  if (patch.rank !== undefined) f["Rank"] = patch.rank;
  if (patch.includedHours !== undefined) f["Included Hours"] = patch.includedHours;
  if (patch.monthlyRate !== undefined) f["Monthly Rate"] = patch.monthlyRate;
  if (patch.slaLabel !== undefined) f["SLA Label (client-facing)"] = patch.slaLabel;
  if (patch.maxUrgentPerMonth !== undefined) f["Max Urgent / Month"] = patch.maxUrgentPerMonth;
  if (patch.clientDescription !== undefined) {
    f["Client-facing Description"] = patch.clientDescription;
  }
  if (patch.custom !== undefined) f["Custom"] = patch.custom;
  if (patch.customForCompanyId !== undefined) {
    f["Custom For"] = patch.customForCompanyId ? [patch.customForCompanyId] : [];
  }
  if (patch.slaHours !== undefined) {
    for (const p of PRIORITIES) f[SLA_FIELD[p]] = patch.slaHours[p];
  }
  return f;
}

/**
 * Re-stamp SLA Due At and SLA Outcome for open, unanswered requests on every
 * retainer using this plan. Returns how many were touched.
 *
 * Reads UNCACHED. The 5-minute cache would otherwise hand back the pre-edit
 * plan and write deadlines from the SLA hours we just replaced — and nothing
 * downstream ever recomputes SLA Due At, so those would be wrong permanently.
 */
async function recomputeSlaForPlan(tierId: string): Promise<number> {
  const [tiers, agreements, requests] = await Promise.all([
    listRetainerTiers({ fresh: true }),
    listRetainerAgreements({ fresh: true }),
    listRetainerRequests({ fresh: true }),
  ]);

  const tier = tiers.find((t) => t.id === tierId) ?? null;
  if (!tier) return 0;

  const retainerIds = agreements.filter((a) => a.tierId === tierId).map((a) => a.id);
  const affected = requestsNeedingSlaRecompute(requests, retainerIds);
  if (affected.length === 0) return 0;

  const now = new Date();
  const patches = affected.map((r) => {
    const dueAt = computeSlaDueAt(tier, r.priority ?? "Medium", new Date(r.submittedAt as string));
    return {
      id: r.id,
      fields: {
        "SLA Due At": dueAt ? dueAt.toISOString() : null,
        "SLA Outcome": evaluateSlaOutcome({ dueAt, firstRespondedAt: null, now }),
      },
    };
  });

  await patchRecords(REQ.id, patches);
  revalidateTag("retainers:requests");
  return patches.length;
}

export async function createPlan(
  input: PlanInput,
): Promise<PlanMutationResult<{ id: string }>> {
  const denied = await gate();
  if (denied) return denied;

  const invalid = validatePlanInput(input);
  if (invalid) return { error: invalid };

  try {
    const [created] = await createRecords(TIER.id, [
      { fields: { ...planFields(input), Active: true } },
    ]);
    invalidate();
    return { ok: true, id: created.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updatePlan(
  id: string,
  patch: Partial<PlanInput>,
): Promise<PlanMutationResult<{ recomputed: number }>> {
  const denied = await gate();
  if (denied) return denied;

  try {
    // Validate the MERGED plan, not the patch — a patch that only clears a
    // company would otherwise slip past the custom-needs-a-client rule.
    const tiers = await listRetainerTiers({ fresh: true });
    const existing = tiers.find((t) => t.id === id);
    if (!existing) return { error: "Plan not found." };

    const merged: PlanInput = {
      name: patch.name ?? existing.name,
      rank: patch.rank ?? existing.rank,
      includedHours:
        patch.includedHours !== undefined ? patch.includedHours : existing.includedHours,
      monthlyRate: patch.monthlyRate !== undefined ? patch.monthlyRate : existing.monthlyRate,
      slaHours: patch.slaHours ?? existing.slaHours,
      slaLabel: patch.slaLabel !== undefined ? patch.slaLabel : existing.slaLabel,
      maxUrgentPerMonth:
        patch.maxUrgentPerMonth !== undefined
          ? patch.maxUrgentPerMonth
          : existing.maxUrgentPerMonth,
      clientDescription:
        patch.clientDescription !== undefined
          ? patch.clientDescription
          : existing.clientDescription,
      custom: patch.custom ?? existing.custom,
      customForCompanyId:
        patch.customForCompanyId !== undefined
          ? patch.customForCompanyId
          : existing.customForCompanyId,
    };

    const invalid = validatePlanInput(merged);
    if (invalid) return { error: invalid };

    const slaChanged =
      patch.slaHours !== undefined &&
      PRIORITIES.some((p) => patch.slaHours![p] !== existing.slaHours[p]);

    await patchRecords(TIER.id, [{ id, fields: planFields(patch) }]);

    const recomputed = slaChanged ? await recomputeSlaForPlan(id) : 0;
    invalidate();
    return { ok: true, recomputed };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Soft delete. Plans are NEVER hard-deleted — a live retainer linking a removed
 * plan would lose both its tier name and its SLA, silently.
 */
export async function setPlanActive(
  id: string,
  active: boolean,
): Promise<PlanMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(TIER.id, [{ id, fields: { Active: active } }]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
