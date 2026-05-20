// Server Actions for Story mutations. All gated by requireRole("admin", "lead").
// After every successful write we invalidate the relevant cache tags so /engineering,
// /me, /backlog, and home tiles refetch.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";

export type StoryPatch = {
  status?: string | null;
  priority?: string | null;
  hours?: number | null;
  hoursWorked?: number | null;
  assigneeIds?: string[];
};

export type MutationResult = { ok: true } | { error: string };

const SPRINT_FIELD_NAME = "📆Sprints";

function buildStoryFields(patch: StoryPatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (patch.status !== undefined) fields["Story Status"] = patch.status;
  if (patch.priority !== undefined) fields["Priority"] = patch.priority;
  if (patch.hours !== undefined) fields["Hours"] = patch.hours;
  if (patch.hoursWorked !== undefined) fields["Hours Worked"] = patch.hoursWorked;
  if (patch.assigneeIds !== undefined) fields["Assignee"] = patch.assigneeIds;
  return fields;
}

function invalidateStoryCaches() {
  // Every cached Airtable read in lib/airtable.ts is tagged with "airtable" — this
  // umbrella revalidation alone is sufficient. The explicit tags below are kept for
  // intent + future-proofing if the umbrella is ever scoped down.
  revalidateTag("airtable");
  revalidateTag("engineering:stories");
  revalidateTag("engineering:people");
  revalidateTag("sprints:all");
  revalidateTag("kpi:sprint-delivery");
}

async function gate(): Promise<{ error: string } | null> {
  try {
    // "editor" is the legacy synonym for "lead" (see lib/auth.ts AppRole comment).
    await requireRole("admin", "lead", "editor");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

export async function updateStory(
  storyId: string,
  patch: StoryPatch,
): Promise<MutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(Tables.Stories.id, [
      { id: storyId, fields: buildStoryFields(patch) },
    ]);
    invalidateStoryCaches();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function bulkUpdateStories(
  storyIds: string[],
  patch: StoryPatch,
): Promise<MutationResult> {
  if (storyIds.length === 0) return { ok: true };
  const denied = await gate();
  if (denied) return denied;

  const fields = buildStoryFields(patch);
  try {
    await patchRecords(
      Tables.Stories.id,
      storyIds.map((id) => ({ id, fields })),
    );
    invalidateStoryCaches();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Sprint planning: change ONLY the sprint links on a story (no assignee change).
// Used when removing a story from a sprint, sending it back to the backlog.
export async function setStorySprint(
  storyId: string,
  sprintRecordIds: string[],
): Promise<MutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(Tables.Stories.id, [
      { id: storyId, fields: { [SPRINT_FIELD_NAME]: sprintRecordIds } },
    ]);
    invalidateStoryCaches();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Sprint planning: set BOTH sprint links + assignees in one PATCH.
// Client passes the already-merged arrays (current + new values).
// Used when planning a story for an engineer in a sprint.
export async function planStory(
  storyId: string,
  sprintIds: string[],
  assigneeIds: string[],
): Promise<MutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(Tables.Stories.id, [
      {
        id: storyId,
        fields: {
          Assignee: assigneeIds,
          [SPRINT_FIELD_NAME]: sprintIds,
        },
      },
    ]);
    invalidateStoryCaches();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type CreateStoryInput = {
  name: string;
  hours: number;
  invoice: number;
  priority?: string;
  assigneeIds?: string[];
  quoteIds?: string[];
  description?: string;
  status?: string;
};

export type CreateStoryResult =
  | { ok: true; id: string }
  | { error: string };

export async function createStory(input: CreateStoryInput): Promise<CreateStoryResult> {
  const denied = await gate();
  if (denied) return denied;

  if (!input.name || input.name.trim() === "") {
    return { error: "Story Name is required" };
  }
  if (input.hours == null || !isFinite(input.hours) || input.hours <= 0) {
    return { error: "Hours must be a positive number" };
  }
  if (input.invoice == null || !isFinite(input.invoice) || input.invoice < 0) {
    return { error: "Invoice value must be 0 or greater" };
  }

  const fields: Record<string, unknown> = {
    "Story Name": input.name.trim(),
    Hours: input.hours,
    Invoice: input.invoice,
    "Story Status": input.status ?? "Todo",
  };
  if (input.priority) fields["Priority"] = input.priority;
  if (input.assigneeIds && input.assigneeIds.length > 0) fields["Assignee"] = input.assigneeIds;
  if (input.quoteIds && input.quoteIds.length > 0) fields["Quote"] = input.quoteIds;
  if (input.description) fields["Description"] = input.description;

  try {
    const created = await createRecords(Tables.Stories.id, [{ fields }]);
    invalidateStoryCaches();
    return { ok: true, id: created[0]?.id ?? "" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
