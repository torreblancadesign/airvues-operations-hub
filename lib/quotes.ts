// Per-quote detail loader for the Pipeline drawer editor.
// Fetches a single Quote + its linked Stories in one shot, plus tiny helpers
// to list People options for the linked-record pickers.
import "server-only";

import { getRecord, listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import type { QuoteAttachment, QuoteDetail, QuoteStoryRow, PersonOption } from "./quote-types";

type QuoteFields = {
  "Project Name"?: string;
  "Prepared by"?: string[];
  "Prepared By Name"?: string[];
  "Prepared Date"?: string;
  "Prepared for"?: string[];
  "Client Name"?: string[];
  "Project Status"?: string;
  "Proposal Type"?: string;
  "Status"?: string;
  "Custom Problem Statement and Solution Summary"?: string;
  "Documents needed for Proposal"?: Array<{
    id: string;
    url?: string;
    filename?: string;
    type?: string;
    size?: number;
  }>;
  "Recommended Approach"?: string;
  "Recommended Approach Summary"?: string;
  "Project Overview"?: string;
  "Problem Statement & Our Solution"?: string;
  "Estimate Hours Range"?: string;
  "Estimate Cost Range"?: string;
  "Stories"?: string[];
  "Total Cost"?: number;
  "Total Hours"?: number;
  "Run AI Proposal Agent"?: boolean;
};

type StoryFields = {
  "Story Name"?: string;
  "Description"?: string;
  "Hours"?: number;
  "Cost"?: number;
  "Invoice"?: number;
  "Client Notes"?: string;
  "Story Status"?: string;
  "Assignee"?: string[];
  "User (from Assignee)"?: string[];
};

function first<T>(x: T[] | undefined): T | null {
  return Array.isArray(x) && x.length > 0 ? x[0] : null;
}

export async function getQuoteDetail(quoteId: string): Promise<QuoteDetail> {
  const t = Tables.Quotes;
  const rec = await getRecord<QuoteFields>(t.id, quoteId);
  const f = rec.fields;

  // Pull linked stories (if any) in one filter call. Cap is fine — quote story
  // counts are small (typically < 30).
  const storyIds = (f["Stories"] as string[] | undefined) ?? [];
  let stories: QuoteStoryRow[] = [];
  if (storyIds.length > 0) {
    const sT = Tables.Stories;
    const formula = `OR(${storyIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const rows = await listRecordsCached<StoryFields>(
      sT.id,
      {
        filterByFormula: formula,
        fields: [
          sT.fields["Story Name"].id,
          sT.fields["Description"].id,
          sT.fields["Hours"].id,
          sT.fields["Cost"].id,
          sT.fields["Invoice"].id,
          sT.fields["Client Notes"].id,
          sT.fields["Story Status"].id,
          sT.fields["Assignee"].id,
          sT.fields["User (from Assignee)"].id,
        ],
      },
      [`quote:${quoteId}:stories`],
    );

    // Preserve quote's story ordering
    const byId = new Map(rows.map((r) => [r.id, r]));
    stories = storyIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => {
        const sf = r.fields;
        const assigneeIds = (sf["Assignee"] as string[] | undefined) ?? [];
        const assigneeNames = (sf["User (from Assignee)"] as string[] | undefined) ?? [];
        return {
          id: r.id,
          name: (sf["Story Name"] as string) ?? "(untitled)",
          description: (sf["Description"] as string) ?? "",
          hours: typeof sf["Hours"] === "number" ? (sf["Hours"] as number) : null,
          cost:
            typeof sf["Cost"] === "number"
              ? (sf["Cost"] as number)
              : typeof sf["Invoice"] === "number"
                ? (sf["Invoice"] as number)
                : null,
          clientNotes: (sf["Client Notes"] as string) ?? "",
          status: (sf["Story Status"] as string) ?? null,
          assignees: assigneeIds.map((id, i) => ({
            id,
            name: assigneeNames[i] ?? "(unknown)",
          })),
        };
      });
  }

  const docs: QuoteAttachment[] = (f["Documents needed for Proposal"] ?? []).map((a) => ({
    id: a.id,
    filename: a.filename ?? "",
    url: a.url ?? "",
    type: a.type ?? null,
    size: typeof a.size === "number" ? a.size : null,
  }));

  return {
    id: rec.id,
    projectName: (f["Project Name"] as string) ?? "",
    preparedById: first(f["Prepared by"] as string[] | undefined),
    preparedByName: first(f["Prepared By Name"] as string[] | undefined),
    preparedDate: (f["Prepared Date"] as string) ?? null,
    preparedForId: first(f["Prepared for"] as string[] | undefined),
    preparedForName: first(f["Client Name"] as string[] | undefined),
    projectStatus: (f["Project Status"] as string) ?? null,
    proposalType: (f["Proposal Type"] as string) ?? null,
    status: (f["Status"] as string) ?? null,
    customProblemStatement: (f["Custom Problem Statement and Solution Summary"] as string) ?? "",
    documents: docs,
    recommendedApproach: (f["Recommended Approach"] as string) ?? "",
    recommendedApproachSummary: (f["Recommended Approach Summary"] as string) ?? "",
    projectOverview: (f["Project Overview"] as string) ?? "",
    problemStatementSolution: (f["Problem Statement & Our Solution"] as string) ?? "",
    estimateHoursRange: (f["Estimate Hours Range"] as string) ?? "",
    estimateCostRange: (f["Estimate Cost Range"] as string) ?? "",
    runAiProposalAgent: f["Run AI Proposal Agent"] === true,
    stories,
    totalCost: (f["Total Cost"] as number) ?? 0,
    totalHours: typeof f["Total Hours"] === "number" ? (f["Total Hours"] as number) : null,
  };
}

// Lightweight People list for the linked-record pickers in the quote drawer.
// Active only, both internal (Prepared by) and external (Prepared for).
export async function listPeopleOptions(): Promise<PersonOption[]> {
  const t = Tables.People;
  const rows = await listRecordsCached<{
    "Full Name"?: string;
    "First Name"?: string;
    "Last Name"?: string;
    "Primary Email"?: string;
    "Status"?: string;
    "Type"?: string;
  }>(
    t.id,
    {
      fields: [
        t.fields["Full Name"].id,
        t.fields["First Name"].id,
        t.fields["Last Name"].id,
        t.fields["Primary Email"].id,
        t.fields["Status"].id,
        t.fields["Type"].id,
      ],
    },
    ["pipeline:people-options"],
  );

  return rows
    .map((r) => {
      const f = r.fields;
      const name =
        (f["Full Name"] as string) ||
        [f["First Name"], f["Last Name"]].filter(Boolean).join(" ").trim() ||
        (f["Primary Email"] as string) ||
        "(no name)";
      const type = (f["Type"] as string) ?? null;
      const status = (f["Status"] as string) ?? null;
      return {
        id: r.id,
        name,
        email: (f["Primary Email"] as string) ?? null,
        isInternal: type === "Internal" || type === "Internal team member",
        isActive: status === "Active",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
