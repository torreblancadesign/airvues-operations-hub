// Server Actions for People mutations. Self-edits + admin/lead overrides.
"use server";

import { revalidateTag } from "next/cache";
import { patchRecords } from "../airtable";
import { Tables } from "../schema";
import { canMutate } from "../authz";
import { getAppSession } from "../session";
import { resolvePersonByEmail } from "../people";

export type MutationResult = { ok: true } | { error: string };

export async function updateAnnualEarningsGoal(args: {
  personId: string;
  goal: number | null;
}): Promise<MutationResult> {
  const { personId, goal } = args;

  // Validate input
  if (!personId) return { error: "Missing personId" };
  if (goal !== null && (!Number.isFinite(goal) || goal < 0)) {
    return { error: "Goal must be a non-negative number" };
  }

  // Permission gate: self-edit OR admin/lead override.
  const session = await getAppSession();
  if (!session?.user) return { error: "Not signed in" };

  const isAdminLead = await canMutate();
  let isSelf = false;
  try {
    const own = await resolvePersonByEmail(session.user.email);
    isSelf = own?.id === personId;
  } catch {
    isSelf = false;
  }

  if (!isAdminLead && !isSelf) {
    return { error: "You can only edit your own goal" };
  }

  try {
    await patchRecords(Tables.People.id, [
      { id: personId, fields: { "Annual Earnings Goal": goal } },
    ]);
    revalidateTag("airtable");
    revalidateTag("scorecard:people-goals");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type ContactPatch = {
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  type?: string | null;
  status?: string | null;
  notes?: string | null;
  vip?: boolean;
};

export async function updateContact(
  personId: string,
  patch: ContactPatch,
): Promise<MutationResult> {
  if (!personId) return { error: "Missing personId" };

  const canEdit = await canMutate();
  if (!canEdit) return { error: "Not authorized" };

  const fields: Record<string, unknown> = {};
  if (patch.title !== undefined) fields["Role"] = patch.title ?? "";
  if (patch.email !== undefined) fields["Primary Email"] = patch.email ?? "";
  if (patch.phone !== undefined) fields["Phone Number"] = patch.phone ?? "";
  if (patch.type !== undefined) fields["Type"] = patch.type || null;
  if (patch.status !== undefined) fields["Status"] = patch.status || null;
  if (patch.notes !== undefined) fields["Client Comments"] = patch.notes ?? "";
  if (patch.vip !== undefined) fields["VIP Client"] = patch.vip;

  try {
    await patchRecords(Tables.People.id, [{ id: personId, fields }]);
    revalidateTag("airtable");
    revalidateTag("client-detail:people");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

