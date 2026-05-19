// Sprint data layer (server-only). Fetches Sprints table + reuses engineering board for stories.
import "server-only";

import { listRecordsCached, AirtableRecord } from "./airtable";
import { Tables } from "./schema";
import { getEngineeringBoard } from "./engineering";
import { COMMISSION_RATE, Story } from "./engineering-types";
import { SprintDetail, SprintStatus, SprintSummary } from "./sprints-types";

type SprintRow = {
  "Sprint Name"?: string;
  "Sprint Number"?: number;
  "Sprint Status"?: string;
  "Sprint Start"?: string;
  "Sprint End"?: string;
  Goals?: string;
  "Sprint Goals"?: string;
};

function buildSummary(rec: AirtableRecord<SprintRow>, stories: Story[]): SprintSummary {
  const f = rec.fields;
  let doneCount = 0;
  let inProgressCount = 0;
  let todoCount = 0;
  let qaCount = 0;
  let hoursScoped = 0;
  let hoursWorked = 0;
  let invoice = 0;
  for (const s of stories) {
    if (s.status === "Completed") doneCount++;
    else if (s.status === "In progress") inProgressCount++;
    else if (s.status === "Todo") todoCount++;
    else if (s.status === "QA Review") qaCount++;
    hoursScoped += s.hours ?? 0;
    hoursWorked += s.hoursWorked ?? 0;
    invoice += s.invoice;
  }
  const completionPct = stories.length > 0 ? (doneCount / stories.length) * 100 : 0;

  return {
    id: rec.id,
    number: (f["Sprint Number"] as number) ?? null,
    name: (f["Sprint Name"] as string) ?? (f["Sprint Number"] != null ? `Sprint ${f["Sprint Number"]}` : "Sprint"),
    status: (f["Sprint Status"] as SprintStatus) ?? null,
    start: (f["Sprint Start"] as string) ?? null,
    end: (f["Sprint End"] as string) ?? null,
    goals: (f["Sprint Goals"] as string) || (f["Goals"] as string) || null,
    storyCount: stories.length,
    doneCount,
    inProgressCount,
    todoCount,
    qaCount,
    hoursScoped,
    hoursWorked,
    invoice,
    commission: invoice * COMMISSION_RATE,
    completionPct,
    airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${Tables.Sprints.id}/${rec.id}`,
  };
}

async function fetchAllSprints(): Promise<AirtableRecord<SprintRow>[]> {
  const t = Tables.Sprints;
  return listRecordsCached<SprintRow>(
    t.id,
    {
      fields: [
        t.fields["Sprint Name"].id,
        t.fields["Sprint Number"].id,
        t.fields["Sprint Status"].id,
        t.fields["Sprint Start"].id,
        t.fields["Sprint End"].id,
        t.fields["Goals"].id,
        t.fields["Sprint Goals"].id,
      ],
    },
    ["sprints:all"],
  );
}

export async function listSprints(): Promise<SprintSummary[]> {
  const [sprintRecords, board] = await Promise.all([fetchAllSprints(), getEngineeringBoard()]);

  const storiesBySprint = new Map<string, Story[]>();
  const seenInSprint = new Map<string, Set<string>>();
  for (const g of board.groups) {
    for (const s of g.stories) {
      for (const sid of s.sprintIds) {
        if (!storiesBySprint.has(sid)) {
          storiesBySprint.set(sid, []);
          seenInSprint.set(sid, new Set());
        }
        if (!seenInSprint.get(sid)!.has(s.id)) {
          seenInSprint.get(sid)!.add(s.id);
          storiesBySprint.get(sid)!.push(s);
        }
      }
    }
  }

  const summaries = sprintRecords.map((r) => buildSummary(r, storiesBySprint.get(r.id) ?? []));

  // Sort: In Progress first, Next second, Done last, then by Sprint Number desc within each
  const rank: Record<string, number> = { "In Progress": 0, Next: 1, Done: 2 };
  summaries.sort((a, b) => {
    const ra = rank[a.status ?? ""] ?? 99;
    const rb = rank[b.status ?? ""] ?? 99;
    if (ra !== rb) return ra - rb;
    return (b.number ?? 0) - (a.number ?? 0);
  });

  return summaries;
}

export async function getSprintDetail(sprintId: string): Promise<SprintDetail | null> {
  const [sprintRecords, board] = await Promise.all([fetchAllSprints(), getEngineeringBoard()]);
  const sprintRecord = sprintRecords.find((r) => r.id === sprintId);
  if (!sprintRecord) return null;

  const stories: Story[] = [];
  const seen = new Set<string>();
  for (const g of board.groups) {
    for (const s of g.stories) {
      if (seen.has(s.id)) continue;
      if (s.sprintIds.includes(sprintId)) {
        seen.add(s.id);
        stories.push(s);
      }
    }
  }

  return { ...buildSummary(sprintRecord, stories), stories };
}

export async function getCurrentSprintId(): Promise<string | null> {
  const sprintRecords = await fetchAllSprints();
  const inProgress = sprintRecords.find((r) => r.fields["Sprint Status"] === "In Progress");
  if (inProgress) return inProgress.id;
  // Fallback: latest by Sprint Number
  let latest: { id: string; number: number } | null = null;
  for (const r of sprintRecords) {
    const n = (r.fields["Sprint Number"] as number) ?? 0;
    if (!latest || n > latest.number) latest = { id: r.id, number: n };
  }
  return latest?.id ?? null;
}
