// Server Actions for Sprint mutations.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireSignedIn } from "../authz";

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
