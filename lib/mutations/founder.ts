// Server Action: update a founder's Retirement Number (annual goal) on People.
"use server";

import { revalidateTag } from "next/cache";
import { patchRecords } from "../airtable";
import { Tables } from "../schema";
import { getAppSession } from "../session";
import { resolvePersonByEmail } from "../people";

export type MutationResult = { ok: true } | { error: string };

export async function updateRetirementNumber(args: {
  personId: string;
  value: number | null;
}): Promise<MutationResult> {
  const { personId, value } = args;
  if (!personId) return { error: "Missing personId" };
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    return { error: "Retirement Number must be a non-negative dollar amount" };
  }

  // Self-edit only: signed-in user must resolve to this personId.
  const session = await getAppSession();
  if (!session?.user) return { error: "Not signed in" };
  const own = await resolvePersonByEmail(session.user.email);
  if (own?.id !== personId) {
    return { error: "You can only edit your own retirement number" };
  }

  try {
    await patchRecords(Tables.People.id, [
      { id: personId, fields: { "Retirement Number": value } },
    ]);
    revalidateTag("airtable");
    revalidateTag(`founder:profile:${personId}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
