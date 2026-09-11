// Server Actions for Sprint mutations.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, deleteRecord, getRecord, listRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, deleteGate, requireSignedIn } from "../authz";

export type CreateSprintInput = {
  number: number;
  status?: "Next" | "In Progress" | "Done";
  start: string;
  goal?: string;
  goals?: string;
};

export type CreateSprintResult =
  | { ok: true; id: string }
  | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireSignedIn();
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("sprints:all");
  revalidateTag("kpi:sprint-delivery");
}

export async function createSprint(input: CreateSprintInput): Promise<CreateSprintResult> {
  const denied = await gate();
  if (denied) return denied;

  if (!Number.isFinite(input.number) || input.number <= 0) {
    return { error: "Sprint Number must be a positive integer" };
  }
  if (!input.start) {
    return { error: "Sprint Start is required" };
  }

  const fields: Record<string, unknown> = {
    "Sprint Number": Math.floor(input.number),
    "Sprint Status": input.status ?? "Next",
    "Sprint Start": input.start,
  };
  if (input.goal) fields["Sprint Goals"] = input.goal;
  if (input.goals) fields["Goals"] = input.goals;

  try {
    const created = await createRecords(Tables.Sprints.id, [{ fields }]);
    invalidate();
    return { ok: true, id: created[0]?.id ?? "" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateSprintStatus(
  sprintId: string,
  status: "Next" | "In Progress" | "Done",
): Promise<{ ok: true } | { error: string }> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(Tables.Sprints.id, [
      { id: sprintId, fields: { "Sprint Status": status } },
    ]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Hard-delete a sprint. admin/lead only.
 *
 * Stories are NOT deleted — they lose their 📆Sprints link and fall back to the
 * backlog, which is where an unplanned story belongs anyway. Sprint Capacity
 * rows ARE deleted: they are keyed on (Person, Sprint) and mean nothing once
 * the sprint is gone, so leaving them would just be dead rows pointing at a
 * record that no longer exists.
 */
export async function deleteSprint(
  sprintId: string,
): Promise<{ ok: true; storiesUnlinked: number; capacityRowsDeleted: number } | { error: string }> {
  if (!sprintId || !sprintId.startsWith("rec")) return { error: "Invalid sprintId" };
  const denied = await deleteGate();
  if (denied) return denied;

  try {
    const sprint = await getRecord<Record<string, unknown>>(Tables.Sprints.id, sprintId);
    const linked = sprint.fields["Stories"];
    const storiesUnlinked = Array.isArray(linked) ? linked.length : 0;

    // Read UNCACHED — a capacity row saved inside the 5-minute window would
    // otherwise survive the cascade and be left dangling.
    const cap = Tables.SprintCapacity;
    const rows = await listRecords<Record<string, unknown>>(cap.id, {
      fields: [cap.fields["Sprint"].id],
    });
    const mine = rows.filter((r) => {
      const link = r.fields["Sprint"];
      return Array.isArray(link) && link.includes(sprintId);
    });

    for (const r of mine) {
      await deleteRecord(cap.id, r.id);
      // Airtable allows 5 requests/second per base and deleteRecord has no
      // built-in spacing the way patchRecords does.
      await new Promise((resolve) => setTimeout(resolve, 220));
    }

    await deleteRecord(Tables.Sprints.id, sprintId);
    invalidate();
    revalidateTag("engineering:stories");
    return { ok: true, storiesUnlinked, capacityRowsDeleted: mine.length };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
