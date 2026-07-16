// Server Actions for Story mutations. All gated by requireSignedIn().
// After every successful write we invalidate the relevant cache tags so /engineering,
// /me, /backlog, and home tiles refetch.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords, deleteRecord } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireSignedIn } from "../authz";
import { logEventInternal } from "./project-log";

export type StoryPatch = {
  name?: string;
  description?: string;
  invoice?: number | null;
  status?: string | null;
  priority?: string | null;
  hours?: number | null;
  hoursWorked?: number | null;
  assigneeIds?: string[];
  phase?: string | null;
  sprintIds?: string[];
  comments?: string;
  clientNotes?: string;
  completedDate?: string | null;
  tags?: string[];
};

export type MutationResult = { ok: true } | { error: string };

const SPRINT_FIELD_NAME = "📆Sprints";

function buildStoryFields(patch: StoryPatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields["Story Name"] = patch.name;
  if (patch.description !== undefined) fields["Description"] = patch.description;
  if (patch.invoice !== undefined) {
    // Stories have two currency fields ("Cost" and "Invoice"). Reads come from
    // "Cost"; createQuoteStory writes both. Keep them in sync on update too.
    fields["Invoice"] = patch.invoice;
    fields["Cost"] = patch.invoice;
  }
  if (patch.status !== undefined) fields["Story Status"] = patch.status;
  if (patch.priority !== undefined) fields["Priority"] = patch.priority;
  if (patch.hours !== undefined) fields["Hours"] = patch.hours;
  if (patch.hoursWorked !== undefined) fields["Hours Worked"] = patch.hoursWorked;
  if (patch.assigneeIds !== undefined) fields["Assignee"] = patch.assigneeIds;
  if (patch.phase !== undefined) fields["Phase"] = patch.phase;
  if (patch.sprintIds !== undefined) fields[SPRINT_FIELD_NAME] = patch.sprintIds;
  if (patch.comments !== undefined) fields["Comments"] = patch.comments;
  if (patch.clientNotes !== undefined) fields["Client Notes"] = patch.clientNotes;
  if (patch.completedDate !== undefined) fields["Completed Date"] = patch.completedDate;
  if (patch.tags !== undefined) fields["Tags"] = patch.tags.join(", ");
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
    await requireSignedIn();
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
    if (patch.status === "Completed") {
      await logEventInternal({
        projectId: null,
        eventType: "Story completed",
        detail: `Story ${storyId} marked Completed`,
      });
    }
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
    const id = created[0]?.id ?? "";
    const projectId = input.quoteIds?.[0] ?? null;
    await logEventInternal({
      projectId,
      eventType: "Story created",
      detail: `${input.name.trim()} · ${input.hours}h`,
    });
    return { ok: true, id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteStory(storyId: string): Promise<MutationResult> {
  const denied = await gate();
  if (denied) return denied;
  try {
    await deleteRecord(Tables.Stories.id, storyId);
    invalidateStoryCaches();
    revalidateTag("pipeline:all-quotes");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Duplicate an existing story and place the copy in the "Next" sprint.
// Used when a story is bigger than expected — the team wants a placeholder in
// next sprint that can later be split. Status is reset to Todo; assignees,
// quote link, phase, hours, invoice, priority, description carry over.
export type DuplicateResult =
  | { ok: true; id: string; sprintNumber: number | null }
  | { error: string };

export async function duplicateStoryToNextSprint(
  storyId: string,
): Promise<DuplicateResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    const { getRecord, listRecordsCached } = await import("../airtable");
    const src = await getRecord<Record<string, unknown>>(Tables.Stories.id, storyId);
    if (!src) return { error: "Story not found" };
    const f = src.fields;

    // Find the Sprint record where Sprint Status = "Next".
    const sprints = await listRecordsCached<Record<string, unknown>>(
      Tables.Sprints.id,
      {
        fields: [
          Tables.Sprints.fields["Sprint Status"].id,
          Tables.Sprints.fields["Sprint Number"].id,
        ],
      },
      ["sprints:all"],
    );
    const next = sprints.find((s) => s.fields["Sprint Status"] === "Next");
    if (!next) {
      return {
        error: "No sprint with status 'Next' exists. Create one in /sprints first.",
      };
    }
    const nextNumber = (next.fields["Sprint Number"] as number) ?? null;

    const baseName = ((f["Story Name"] as string) ?? "(untitled)").trim();
    const newName = baseName.endsWith("(cont.)") ? baseName : `${baseName} (cont.)`;

    const fields: Record<string, unknown> = {
      "Story Name": newName,
      "Story Status": "Todo",
      [SPRINT_FIELD_NAME]: [next.id],
    };
    const carry = (key: string, dst = key) => {
      const v = f[key];
      if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) {
        fields[dst] = v;
      }
    };
    carry("Hours");
    carry("Invoice");
    carry("Priority");
    carry("Phase");
    carry("Description");
    carry("Assignee");
    carry("Quote");

    const created = await createRecords(Tables.Stories.id, [{ fields }]);
    invalidateStoryCaches();
    return {
      ok: true,
      id: created[0]?.id ?? "",
      sprintNumber: nextNumber,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
