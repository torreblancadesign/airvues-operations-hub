// Engineering board data layer — bulk-fetches Stories + People, groups by Assignee,
// computes per-engineer + global rollups. Commission = 15% of Story.Invoice (flat for now).
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import {
  COMMISSION_RATE,
  EngineerGroup,
  EngineeringBoardData,
  Story,
} from "./engineering-types";

export { COMMISSION_RATE };
export type { Story, EngineerGroup, EngineeringBoardData };

// Fetch a single Story by record id, shaped exactly like the engineering board's
// Story rows. Used by the Pipeline quote drawer to open the existing StorySheet.
export async function getStoryById(storyId: string): Promise<Story | null> {
  if (!storyId || !storyId.startsWith("rec")) return null;
  const sTbl = Tables.Stories;
  const { getRecord } = await import("./airtable");
  let rec;
  try {
    rec = await getRecord<Record<string, unknown>>(sTbl.id, storyId);
  } catch {
    return null;
  }
  const f = rec.fields;

  const assigneeIds = asArray<string>(f["Assignee"]);
  const clientIds = asArray<string>(f["Client"]);
  const quoteIds = asArray<string>(f["Quote"]);
  const sprintIds = asArray<string>(f["📆Sprints"]);
  const sprintNumbers = asArray<number>(f["Sprint Number (from 📆Sprints)"]);
  const sprintStatuses = asArray<string>(f["Sprint Status (from 📆Sprints)"]);
  const sprintEnds = asArray<string>(f["Sprint End (from 📆Sprints)"]);

  let assigneeNames: string[] = [];
  if (assigneeIds.length > 0) {
    const pTbl = Tables.People;
    const people = await listRecordsCached<Record<string, unknown>>(
      pTbl.id,
      {
        fields: [
          pTbl.fields["Full Name"].id,
          pTbl.fields["First Name"].id,
          pTbl.fields["Last Name"].id,
        ],
      },
      ["engineering:people"],
    );
    const map = new Map<string, string>();
    for (const p of people) {
      const pf = p.fields;
      const nm =
        (pf["Full Name"] as string) ||
        [pf["First Name"], pf["Last Name"]].filter(Boolean).join(" ").trim() ||
        "(unnamed)";
      map.set(p.id, nm);
    }
    assigneeNames = assigneeIds.map((id) => map.get(id) ?? "(unknown)");
  }

  const clientNames = asArray<string>(f["Client Name (from Quote)"]);
  const invoice = (f["Invoice"] as number) ?? 0;

  let quoteLabels: string[] = [];
  if (quoteIds.length > 0) {
    const qTbl = Tables.Quotes;
    const quotes = await listRecordsCached<Record<string, unknown>>(
      qTbl.id,
      {
        fields: [
          qTbl.fields["Quote ID"].id,
          qTbl.fields["Project Name"].id,
          qTbl.fields["Company Name"].id,
        ],
      },
      ["engineering:quotes"],
    );
    const qmap = new Map<string, string>();
    for (const q of quotes) {
      const qf = q.fields;
      const project = (qf["Project Name"] as string) ?? "";
      const company = ((qf["Company Name"] as string[] | undefined)?.[0]) ?? "";
      const qid = (qf["Quote ID"] as string) ?? "";
      const label = [company, project].filter(Boolean).join(" · ") || qid || "(quote)";
      qmap.set(q.id, label);
    }
    quoteLabels = quoteIds.map((id) => qmap.get(id) ?? "(quote)");
  }

  return {
    id: rec.id,
    storyNumber: (f["ID"] as number) ?? null,
    name: (f["Story Name"] as string) ?? "(untitled)",
    status: (f["Story Status"] as string) ?? null,
    priority: (f["Priority"] as string) ?? null,
    phase: (f["Phase"] as string) ?? null,
    hours: (f["Hours"] as number) ?? null,
    hoursWorked: (f["Hours Worked"] as number) ?? null,
    invoice,
    cost: (f["Cost"] as number) ?? 0,
    commission: invoice * COMMISSION_RATE,
    budgetPctUsed: (f[" Budget % Used"] as number) ?? null,
    assigneeIds,
    assigneeNames,
    clientIds,
    clientNames,
    quoteIds,
    quoteLabels,
    sprintIds,
    sprintNumbers,
    sprintStatuses,
    sprintEnds,
    completedDate: (f["Completed Date"] as string) ?? null,
    payStatus: asArray<string>(f["Pay Status (from Quote)"]),
    description: (f["Description"] as string) ?? "",
    airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${sTbl.id}/${rec.id}`,
  };
}

const DONE_STATUS = "Completed";
const ACTIVE_STATUSES = ["Todo", "In progress", "QA Review", "Analysis Required"];

function firstString(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (typeof v === "string") return v;
  return null;
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function getEngineeringBoard(): Promise<EngineeringBoardData> {
  const sTbl = Tables.Stories;
  const pTbl = Tables.People;
  const qTbl = Tables.Quotes;

  const [storyRecords, peopleRecords, quoteRecords] = await Promise.all([
    listRecordsCached<Record<string, unknown>>(
      sTbl.id,
      {
        fields: [
          sTbl.fields["ID"].id,
          sTbl.fields["Story Name"].id,
          sTbl.fields["Description"].id,
          sTbl.fields["Hours"].id,
          sTbl.fields["Hours Worked"].id,
          sTbl.fields["Invoice"].id,
          sTbl.fields["Cost"].id,
          sTbl.fields[" Budget % Used"].id,
          sTbl.fields["Priority"].id,
          sTbl.fields["Phase"].id,
          sTbl.fields["Story Status"].id,
          sTbl.fields["Assignee"].id,
          sTbl.fields["Client"].id,
          "Client Name (from Quote)",
          sTbl.fields["Quote"].id,
          sTbl.fields["📆Sprints"].id,
          sTbl.fields["Sprint Number (from 📆Sprints)"].id,
          sTbl.fields["Sprint Status (from 📆Sprints)"].id,
          sTbl.fields["Sprint End (from 📆Sprints)"].id,
          // New field — schema.ts not yet regenerated; pass by name.
          "Completed Date",
        ],
      },
      ["engineering:stories"],
    ),
    listRecordsCached<Record<string, unknown>>(
      pTbl.id,
      {
        fields: [
          pTbl.fields["Full Name"].id,
          pTbl.fields["First Name"].id,
          pTbl.fields["Last Name"].id,
          pTbl.fields["Role"].id,
          pTbl.fields["Internal Type"].id,
          pTbl.fields["Status"].id,
          pTbl.fields["Type"].id,
        ],
      },
      ["engineering:people"],
    ),
    listRecordsCached<Record<string, unknown>>(
      qTbl.id,
      {
        fields: [
          qTbl.fields["Quote ID"].id,
          qTbl.fields["Project Name"].id,
          qTbl.fields["Company Name"].id,
        ],
      },
      ["engineering:quotes"],
    ),
  ]);

  const quoteMap = new Map<string, string>();
  for (const q of quoteRecords) {
    const f = q.fields;
    const project = (f["Project Name"] as string) ?? "";
    const company = ((f["Company Name"] as string[] | undefined)?.[0]) ?? "";
    const quoteId = (f["Quote ID"] as string) ?? "";
    const label = [company, project].filter(Boolean).join(" · ") || quoteId || "(quote)";
    quoteMap.set(q.id, label);
  }

  type PersonRow = {
    id: string;
    name: string;
    role: string | null;
    internalType: string | null;
    status: string | null;
    type: string | null;
  };

  const peopleMap = new Map<string, PersonRow>();
  for (const p of peopleRecords) {
    const f = p.fields;
    const fullName = (f["Full Name"] as string) ||
      [f["First Name"], f["Last Name"]].filter(Boolean).join(" ").trim() ||
      "(unnamed)";
    peopleMap.set(p.id, {
      id: p.id,
      name: fullName,
      role: (f["Role"] as string) ?? null,
      internalType: (f["Internal Type"] as string) ?? null,
      status: (f["Status"] as string) ?? null,
      type: (f["Type"] as string) ?? null,
    });
  }

  const stories: Story[] = storyRecords.map((r) => {
    const f = r.fields;
    const status = (f["Story Status"] as string) ?? null;
    const invoice = (f["Invoice"] as number) ?? 0;
    const assigneeIds = asArray<string>(f["Assignee"]);
    const clientIds = asArray<string>(f["Client"]);
    const quoteIds = asArray<string>(f["Quote"]);
    const sprintIds = asArray<string>(f["📆Sprints"]);
    const sprintNumbers = asArray<number>(f["Sprint Number (from 📆Sprints)"]);
    const sprintStatuses = asArray<string>(f["Sprint Status (from 📆Sprints)"]);
    const sprintEnds = asArray<string>(f["Sprint End (from 📆Sprints)"]);


    const assigneeNames = assigneeIds.map((id) => peopleMap.get(id)?.name ?? "(unknown)");
    const clientNames = asArray<string>(f["Client Name (from Quote)"]);

    return {
      id: r.id,
      storyNumber: (f["ID"] as number) ?? null,
      name: (f["Story Name"] as string) ?? "(untitled)",
      status,
      priority: (f["Priority"] as string) ?? null,
      phase: (f["Phase"] as string) ?? null,
      hours: (f["Hours"] as number) ?? null,
      hoursWorked: (f["Hours Worked"] as number) ?? null,
      invoice,
      cost: (f["Cost"] as number) ?? 0,
      commission: invoice * COMMISSION_RATE,
      budgetPctUsed: (f[" Budget % Used"] as number) ?? null,
      assigneeIds,
      assigneeNames,
      clientIds,
      clientNames,
      quoteIds,
      quoteLabels: quoteIds.map((id) => quoteMap.get(id) ?? "(quote)"),
      sprintIds,
      sprintNumbers,
      sprintStatuses,
      sprintEnds,
      completedDate: (f["Completed Date"] as string) ?? null,
      description: (f["Description"] as string) ?? "",
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${sTbl.id}/${r.id}`,
    };
  });

  const groupsMap = new Map<string, EngineerGroup>();
  const orphan: EngineerGroup = {
    id: "__orphan__",
    name: "Unassigned",
    role: null,
    internalType: null,
    isOrphan: true,
    stories: [],
    totals: emptyTotals(),
  };

  for (const story of stories) {
    if (story.status === "Archived" || story.status === "On Hold") continue;

    if (story.assigneeIds.length === 0) {
      orphan.stories.push(story);
      continue;
    }
    for (let i = 0; i < story.assigneeIds.length; i++) {
      const pid = story.assigneeIds[i];
      const pname = story.assigneeNames[i] ?? "(unknown)";
      let group = groupsMap.get(pid);
      if (!group) {
        const personRow = peopleMap.get(pid);
        group = {
          id: pid,
          name: pname,
          role: personRow?.role ?? null,
          internalType: personRow?.internalType ?? null,
          isOrphan: false,
          stories: [],
          totals: emptyTotals(),
        };
        groupsMap.set(pid, group);
      }
      group.stories.push(story);
    }
  }

  for (const g of [...groupsMap.values(), orphan]) {
    tallyGroup(g);
  }

  const groups = [...groupsMap.values()].sort(
    (a, b) => b.totals.openCommission - a.totals.openCommission,
  );

  const assignablePeople = [...peopleMap.values()]
    .filter(
      (p) =>
        p.status === "Active" &&
        (p.type === "Internal" || p.type === "Internal team member"),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      internalType: p.internalType,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const board: EngineeringBoardData = {
    groups: orphan.stories.length > 0 ? [orphan, ...groups] : groups,
    assignablePeople,
    totals: tallyGlobal(stories),
    clients: [...new Set(stories.flatMap((s) => s.clientNames))].filter(Boolean).sort(),
    sprints: dedupeSprints(stories),
    statuses: [...new Set(stories.map((s) => s.status).filter(Boolean) as string[])].sort(),
  };


  return board;
}

function emptyTotals(): EngineerGroup["totals"] {
  return {
    storyCount: 0,
    activeCount: 0,
    doneCount: 0,
    inProgressCount: 0,
    todoCount: 0,
    onHoldCount: 0,
    qaCount: 0,
    activeHoursAssigned: 0,
    activeHoursWorked: 0,
    openInvoice: 0,
    openCommission: 0,
    earnedInvoice: 0,
    earnedCommission: 0,
  };
}

function tallyGroup(g: EngineerGroup): void {
  for (const s of g.stories) {
    g.totals.storyCount++;
    if (s.status === DONE_STATUS) {
      g.totals.doneCount++;
      g.totals.earnedInvoice += s.invoice;
      g.totals.earnedCommission += s.commission;
    } else {
      g.totals.openInvoice += s.invoice;
      g.totals.openCommission += s.commission;
      g.totals.activeHoursAssigned += s.hours ?? 0;
      g.totals.activeHoursWorked += s.hoursWorked ?? 0;
    }
    if (s.status === "In progress") g.totals.inProgressCount++;
    if (s.status === "Todo") g.totals.todoCount++;
    if (s.status === "On Hold") g.totals.onHoldCount++;
    if (s.status === "QA Review") g.totals.qaCount++;
    if (ACTIVE_STATUSES.includes(s.status ?? "")) g.totals.activeCount++;
  }
}

function tallyGlobal(stories: Story[]): EngineeringBoardData["totals"] {
  let totalStories = 0;
  let activeStories = 0;
  let orphanStories = 0;
  let completedStories = 0;
  let openInvoice = 0;
  let openCommission = 0;
  let earnedInvoice = 0;
  let earnedCommission = 0;
  let overBudgetCount = 0;
  let qaReviewCount = 0;
  let analysisRequiredCount = 0;

  for (const s of stories) {
    if (s.status === "Archived" || s.status === "On Hold") continue;
    totalStories++;
    if (s.status === DONE_STATUS) {
      completedStories++;
      earnedInvoice += s.invoice;
      earnedCommission += s.commission;
    } else {
      openInvoice += s.invoice;
      openCommission += s.commission;
    }
    if (ACTIVE_STATUSES.includes(s.status ?? "")) activeStories++;
    if (s.assigneeIds.length === 0 && s.status !== DONE_STATUS) orphanStories++;
    if (s.budgetPctUsed != null && s.budgetPctUsed > 1) overBudgetCount++;
    if (s.status === "QA Review") qaReviewCount++;
    if (s.status === "Analysis Required") analysisRequiredCount++;
  }

  return {
    totalStories,
    activeStories,
    orphanStories,
    completedStories,
    openInvoice,
    openCommission,
    earnedInvoice,
    earnedCommission,
    overBudgetCount,
    qaReviewCount,
    analysisRequiredCount,
  };
}

function dedupeSprints(stories: Story[]): { number: number; status: string | null }[] {
  const seen = new Map<number, string | null>();
  for (const s of stories) {
    for (let i = 0; i < s.sprintNumbers.length; i++) {
      const n = s.sprintNumbers[i];
      if (n == null) continue;
      const st = s.sprintStatuses[i] ?? null;
      if (!seen.has(n)) seen.set(n, st);
    }
  }
  return [...seen.entries()]
    .map(([number, status]) => ({ number, status }))
    .sort((a, b) => b.number - a.number);
}
