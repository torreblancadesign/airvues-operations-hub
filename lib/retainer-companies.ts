// Company picker options for retainer surfaces. Server-only — pulls airtable.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type CompanyOption = { id: string; name: string };

/** Every company, by name. Shared by the plan catalog and the retainer forms. */
export async function listCompanyOptions(): Promise<CompanyOption[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    Tables.Companies.id,
    { fields: [Tables.Companies.fields["Name"].id] },
    ["retainers:company-names"],
  );
  return rows
    .flatMap((r) => {
      const n = r.fields["Name"];
      return typeof n === "string" && n.trim() !== "" ? [{ id: r.id, name: n }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
