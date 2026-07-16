// Per-engineer per-sprint capacity setter. Upserts a row in 🟢 Sprint Capacity
// (PATCH if a row already exists for (Person, Sprint), CREATE otherwise).
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, listRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireSignedIn } from "../authz";

export type SetCapacityResult = { ok: true } | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireSignedIn();
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function firstLinkedId(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const item = v[0];
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
    return (item as { id: string }).id;
  }
  return null;
}

export async function setSprintCapacity(input: {
  sprintId: string;
  personId: string;
  capacity: number;
}): Promise<SetCapacityResult> {
  const denied = await gate();
  if (denied) return denied;

  const { sprintId, personId, capacity } = input;
  if (!sprintId || !personId) return { error: "sprintId and personId are required" };
  const cap = Number.isFinite(capacity) ? Math.max(0, capacity) : 0;

  try {
    const t = Tables.SprintCapacity;
    // Look up existing row directly (filterByFormula on linked-record IDs is
    // brittle; fetch the few rows for the sprint and match in JS).
    const existing = await listRecords<{
      People?: unknown;
      Sprint?: unknown;
    }>(t.id, {
      fields: [t.fields["People"].id, t.fields["Sprint"].id],
    });
    const match = existing.find((r) => {
      return (
        firstLinkedId(r.fields.Sprint) === sprintId &&
        firstLinkedId(r.fields.People) === personId
      );
    });

    if (match) {
      await patchRecords(t.id, [
        { id: match.id, fields: { "total hours committed": cap } },
      ]);
    } else {
      await createRecords(t.id, [
        {
          fields: {
            People: [personId],
            Sprint: [sprintId],
            "total hours committed": cap,
          },
        },
      ]);
    }

    revalidateTag("airtable");
    revalidateTag(`sprint-capacity:${sprintId}`);
    revalidateTag("sprint-capacity:all");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
