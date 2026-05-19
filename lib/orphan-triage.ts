// Server-only data layer for orphan-stories triage.
// Groups all unassigned active stories by their parent Quote (most common
// natural grouping) and suggests an engineer from Quote.Prepared by.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { getEngineeringBoard } from "./engineering";
import { COMMISSION_RATE, Story } from "./engineering-types";
import { OrphanGroup, OrphanTriageData } from "./orphan-triage-types";

const UNGROUPED_KEY = "__ungrouped__";

export async function getOrphanTriage(): Promise<OrphanTriageData> {
  const board = await getEngineeringBoard();
  const orphanGroup = board.groups.find((g) => g.isOrphan);
  const orphanStories = orphanGroup?.stories ?? [];

  // Build engineers list (deduped from non-orphan groups)
  const engineers = board.groups
    .filter((g) => !g.isOrphan)
    .map((g) => ({ id: g.id, name: g.name }));

  // Collect quote IDs referenced by orphans
  const quoteIds = new Set<string>();
  for (const s of orphanStories) {
    for (const qid of s.quoteIds) quoteIds.add(qid);
  }

  // Fetch only the Quotes we need (with Prepared by + label info)
  type QuoteRow = {
    "Quote ID"?: string;
    "Project Name"?: string;
    "Company Name"?: string[];
    "Client Name"?: string[];
    Status?: string;
    "Prepared by"?: string[];
  };
  let quoteRecords: { id: string; fields: QuoteRow }[] = [];
  if (quoteIds.size > 0) {
    const qT = Tables.Quotes;
    const formula = `OR(${[...quoteIds].map((id) => `RECORD_ID() = "${id}"`).join(",")})`;
    quoteRecords = await listRecordsCached<QuoteRow>(
      qT.id,
      {
        filterByFormula: formula,
        fields: [
          qT.fields["Quote ID"].id,
          qT.fields["Project Name"].id,
          qT.fields["Company Name"].id,
          qT.fields["Client Name"].id,
          qT.fields["Status"].id,
          qT.fields["Prepared by"].id,
        ],
      },
      ["orphan-triage:quotes"],
    );
  }

  // Engineer name lookup (for "Prepared by" → engineer name)
  const engineerNameById = new Map(engineers.map((e) => [e.id, e.name]));

  // Build Quote lookup with derived suggestedEngineerId
  type QuoteMeta = {
    label: string;
    client: string | null;
    status: string | null;
    suggestedEngineerId: string | null;
    suggestedEngineerName: string | null;
  };
  const quoteMeta = new Map<string, QuoteMeta>();
  for (const q of quoteRecords) {
    const f = q.fields;
    const project = (f["Project Name"] as string) ?? "(no name)";
    const company = (f["Company Name"] as string[] | undefined)?.[0] ?? "";
    const clientNm = (f["Client Name"] as string[] | undefined)?.[0] ?? "";
    const label = [company || clientNm, project].filter(Boolean).join(" · ") || project;
    const preparedByIds = (f["Prepared by"] as string[] | undefined) ?? [];
    const preparedById = preparedByIds[0] ?? null;
    const suggestedEngineerId = preparedById && engineerNameById.has(preparedById)
      ? preparedById
      : null;
    quoteMeta.set(q.id, {
      label,
      client: company || clientNm || null,
      status: (f["Status"] as string) ?? null,
      suggestedEngineerId,
      suggestedEngineerName: suggestedEngineerId
        ? engineerNameById.get(suggestedEngineerId) ?? null
        : null,
    });
  }

  // Group stories by their first Quote (or ungrouped if no Quote link)
  const groupMap = new Map<string, OrphanGroup>();
  let ungroupedCount = 0;
  for (const s of orphanStories) {
    if (s.status === "Completed" || s.status === "Archived") continue;
    const quoteId = s.quoteIds[0] ?? null;
    const key = quoteId ?? UNGROUPED_KEY;
    let group = groupMap.get(key);
    if (!group) {
      if (quoteId && quoteMeta.has(quoteId)) {
        const meta = quoteMeta.get(quoteId)!;
        group = {
          groupKey: key,
          quoteId,
          quoteLabel: meta.label,
          client: meta.client,
          status: meta.status,
          suggestedEngineerId: meta.suggestedEngineerId,
          suggestedEngineerName: meta.suggestedEngineerName,
          stories: [],
          totalInvoice: 0,
          totalHours: 0,
          totalCommission: 0,
        };
      } else {
        group = {
          groupKey: UNGROUPED_KEY,
          quoteId: null,
          quoteLabel: "Stories with no Quote link",
          client: null,
          status: null,
          suggestedEngineerId: null,
          suggestedEngineerName: null,
          stories: [],
          totalInvoice: 0,
          totalHours: 0,
          totalCommission: 0,
        };
      }
      groupMap.set(key, group);
    }
    group.stories.push(s);
    group.totalInvoice += s.invoice;
    group.totalHours += s.hours ?? 0;
    group.totalCommission += s.invoice * COMMISSION_RATE;
    if (key === UNGROUPED_KEY) ungroupedCount++;
  }

  // Sort: ungrouped last; otherwise by total invoice desc
  const groups = [...groupMap.values()].sort((a, b) => {
    if (a.groupKey === UNGROUPED_KEY) return 1;
    if (b.groupKey === UNGROUPED_KEY) return -1;
    return b.totalInvoice - a.totalInvoice;
  });

  let totalInvoice = 0;
  let totalCommission = 0;
  for (const g of groups) {
    totalInvoice += g.totalInvoice;
    totalCommission += g.totalCommission;
  }

  return {
    totalOrphans: orphanStories.length,
    totalInvoice,
    totalCommission,
    groups,
    engineers,
    ungroupedCount,
  };
}
