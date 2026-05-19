// Lightweight quote list — used by the NewStoryModal picker.
// Returns recent quotes that are reasonable parents for new Stories.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type QuoteOption = {
  id: string;
  label: string;
  totalCost: number;
  status: string | null;
  client: string | null;
};

const EXCLUDED_STATUSES = new Set(["Cancelled", "Rejected", "Draft"]);

export async function listQuoteOptions(): Promise<QuoteOption[]> {
  const t = Tables.Quotes;
  const records = await listRecordsCached<{
    "Quote ID"?: string;
    "Project Name"?: string;
    "Company Name"?: string[];
    "Client Name"?: string[];
    Status?: string;
    "Total Project Cost"?: number;
    "Prepared Date"?: string;
  }>(
    t.id,
    {
      fields: [
        t.fields["Quote ID"].id,
        t.fields["Project Name"].id,
        t.fields["Company Name"].id,
        t.fields["Client Name"].id,
        t.fields["Status"].id,
        t.fields["Total Project Cost"].id,
        t.fields["Prepared Date"].id,
      ],
      sort: [{ field: t.fields["Prepared Date"].id, direction: "desc" }],
    },
    ["quotes:options"],
  );

  return records
    .filter((r) => !EXCLUDED_STATUSES.has(r.fields.Status ?? ""))
    .map((r) => {
      const f = r.fields;
      const project = (f["Project Name"] as string) ?? "(no name)";
      const company = (f["Company Name"] as string[] | undefined)?.[0] ?? "";
      const client = (f["Client Name"] as string[] | undefined)?.[0] ?? "";
      const display = [company || client, project].filter(Boolean).join(" · ");
      return {
        id: r.id,
        label: display || project,
        totalCost: (f["Total Project Cost"] as number) ?? 0,
        status: (f["Status"] as string) ?? null,
        client: company || client || null,
      };
    });
}
