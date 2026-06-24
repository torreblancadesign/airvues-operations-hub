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
  "Client Delivery Due Date"?: string;
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
  "Estimate Cost Range"?: unknown;
  "Stories"?: string[];
  "Total Cost"?: number;
  "Total Hours"?: number;
  "Run AI Proposal Agent"?: boolean;
  "Run AI Change Order Agent"?: boolean;
  "Blueprint"?: boolean;
  "Epic Owner"?: string[];
  "Change Order Details"?: string;
  "Change Order Input Details"?: string;
  "Change Order Estimate Cost"?: string;
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
  "Change Order"?: boolean;
  "Quote Order"?: number;

};

// Airtable rich-text / formula / rollup fields occasionally return non-string
// values (objects like { specialValue: "NaN" }, arrays from rollups, etc.).
// Coerce to a safe string so downstream React renders + .trim() calls never throw.
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Linked-record fields normally return string[] of record IDs, but
// Collaborator/User fields return [{id, email, name}, ...]. Coerce both.
function asIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") out.push(item);
    else if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
      out.push((item as { id: string }).id);
    }
  }
  return out;
}

function firstId(v: unknown): string | null {
  const arr = asIdArray(v);
  return arr.length > 0 ? arr[0] : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
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
          sT.fields["Change Order"].id,
          sT.fields["Quote Order"].id,
        ],
      },
      [`quote:${quoteId}:stories`],
    );

    // Preserve quote's story ordering as the tiebreaker, but sort primarily by Quote Order.
    const byId = new Map(rows.map((r) => [r.id, r]));
    const linkIndex = new Map(storyIds.map((id, i) => [id, i]));
    stories = storyIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => {
        const sf = r.fields;
        const assigneeIds = asIdArray(sf["Assignee"]);
        const assigneeNames = asStringArray(sf["User (from Assignee)"]);
        return {
          id: r.id,
          name: asStr(sf["Story Name"]) || "(untitled)",
          description: asStr(sf["Description"]),
          hours: typeof sf["Hours"] === "number" ? (sf["Hours"] as number) : null,
          cost:
            typeof sf["Cost"] === "number"
              ? (sf["Cost"] as number)
              : typeof sf["Invoice"] === "number"
                ? (sf["Invoice"] as number)
                : null,
          clientNotes: asStr(sf["Client Notes"]),
          status: asStr(sf["Story Status"]) || null,
          assignees: assigneeIds.map((id, i) => ({
            id,
            name: assigneeNames[i] ?? "(unknown)",
          })),
          isChangeOrder: sf["Change Order"] === true,
          order: typeof sf["Quote Order"] === "number" ? (sf["Quote Order"] as number) : null,
        };
      })
      .sort((a, b) => {
        const ao = a.order ?? Number.POSITIVE_INFINITY;
        const bo = b.order ?? Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return (linkIndex.get(a.id) ?? 0) - (linkIndex.get(b.id) ?? 0);
      });
  }


  const rawDocs = f["Documents needed for Proposal"];
  const docs: QuoteAttachment[] = (Array.isArray(rawDocs) ? rawDocs : []).map((a) => ({
    id: a.id,
    filename: a.filename ?? "",
    url: a.url ?? "",
    type: a.type ?? null,
    size: typeof a.size === "number" ? a.size : null,
  }));

  // Partition totals by change-order flag (computed locally; quote rollup
  // totals stay as the grand total from Airtable).
  let origCost = 0;
  let origHours = 0;
  let origHasHours = false;
  let coCost = 0;
  let coHours = 0;
  let coHasHours = false;
  for (const s of stories) {
    if (s.isChangeOrder) {
      if (s.cost != null) coCost += s.cost;
      if (s.hours != null) { coHours += s.hours; coHasHours = true; }
    } else {
      if (s.cost != null) origCost += s.cost;
      if (s.hours != null) { origHours += s.hours; origHasHours = true; }
    }
  }

  return {
    id: rec.id,
    projectName: asStr(f["Project Name"]),
    preparedById: firstId(f["Prepared by"]),
    preparedByName: asStringArray(f["Prepared By Name"])[0] ?? null,
    preparedDate: asStr(f["Prepared Date"]) || null,
    deliveryDueDate: asStr(f["Client Delivery Due Date"]) || null,
    preparedForId: firstId(f["Prepared for"]),
    preparedForName: asStringArray(f["Client Name"])[0] ?? null,
    projectStatus: asStr(f["Project Status"]) || null,
    proposalType: asStr(f["Proposal Type"]) || null,
    status: asStr(f["Status"]) || null,
    customProblemStatement: asStr(f["Custom Problem Statement and Solution Summary"]),
    documents: docs,
    recommendedApproach: asStr(f["Recommended Approach"]),
    recommendedApproachSummary: asStr(f["Recommended Approach Summary"]),
    projectOverview: asStr(f["Project Overview"]),
    problemStatementSolution: asStr(f["Problem Statement & Our Solution"]),
    estimateHoursRange: asStr(f["Estimate Hours Range"]),
    estimateCostRange: formatRollupCost(f["Estimate Cost Range"]),

    runAiProposalAgent: f["Run AI Proposal Agent"] === true,
    runAiChangeOrderAgent: f["Run AI Change Order Agent"] === true,
    blueprint: f["Blueprint"] === true,
    epicOwnerId: firstId(f["Epic Owner"]),
    epicOwnerName: null,
    changeOrderDetails: asStr(f["Change Order Details"]),
    changeOrderInputDetails: asStr(f["Change Order Input Details"]),
    changeOrderEstimateCost: asStr(f["Change Order Estimate Cost"]),
    stories,
    totalCost: typeof f["Total Cost"] === "number" ? (f["Total Cost"] as number) : 0,
    totalHours: typeof f["Total Hours"] === "number" ? (f["Total Hours"] as number) : null,
    originalTotalCost: origCost,
    originalTotalHours: origHasHours ? origHours : null,
    changeOrderTotalCost: coCost,
    changeOrderTotalHours: coHasHours ? coHours : null,
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
      const fullName = asStr(f["Full Name"]);
      const firstName = asStr(f["First Name"]);
      const lastName = asStr(f["Last Name"]);
      const email = asStr(f["Primary Email"]);
      const name =
        fullName ||
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        email ||
        "(no name)";
      const type = asStr(f["Type"]) || null;
      const status = asStr(f["Status"]) || null;
      return {
        id: r.id,
        name,
        email: email || null,
        isInternal: type === "Internal" || type === "Internal team member",
        isActive: status === "Active",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
