// Everything that has been soft-deleted, in one place, so a restore never
// requires opening Airtable.
//
// Soft-deleted rows are filtered out of every board, picker and filter in the
// app (that is the point of archiving), which leaves this page as the only way
// back. Reads are UNCACHED: restore is rare, and a 5-minute-stale archive list
// would show a row someone already brought back.
import "server-only";

import { listRecords } from "./airtable";
import { Tables } from "./schema";

export type ArchivedKind = "project" | "account" | "person";

export type ArchivedRow = {
  id: string;
  kind: ArchivedKind;
  name: string;
  /** One line of context so two similar names are still distinguishable. */
  detail: string | null;
  airtableUrl: string;
};

const baseUrl = `https://airtable.com/${process.env.AIRTABLE_BASE_ID ?? "app4vhhWMbRFOloOU"}`;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const firstStr = (v: unknown): string | null =>
  Array.isArray(v) ? (typeof v[0] === "string" ? v[0] : null) : null;

export async function listArchived(): Promise<ArchivedRow[]> {
  const Q = Tables.Quotes;
  const C = Tables.Companies;
  const P = Tables.People;

  const [quotes, companies, people] = await Promise.all([
    listRecords<Record<string, unknown>>(Q.id, {
      filterByFormula: "{Archived}",
      fields: [Q.fields["Project Name"].id, Q.fields["Client Name"].id, Q.fields["Status"].id],
    }),
    listRecords<Record<string, unknown>>(C.id, {
      filterByFormula: "{Archived}",
      fields: [C.fields["Name"].id, C.fields["Engagement Frequency"].id],
    }),
    listRecords<Record<string, unknown>>(P.id, {
      filterByFormula: "{Archived}",
      fields: [
        P.fields["Full Name"].id,
        P.fields["Primary Email"].id,
        P.fields["Internal Type"].id,
      ],
    }),
  ]);

  return [
    ...quotes.map((r) => ({
      id: r.id,
      kind: "project" as const,
      name: str(r.fields["Project Name"]) ?? "(no name)",
      detail: [firstStr(r.fields["Client Name"]), str(r.fields["Status"])]
        .filter(Boolean)
        .join(" · ") || null,
      airtableUrl: `${baseUrl}/${Q.id}/${r.id}`,
    })),
    ...companies.map((r) => ({
      id: r.id,
      kind: "account" as const,
      name: str(r.fields["Name"]) ?? "(no name)",
      detail: str(r.fields["Engagement Frequency"]),
      airtableUrl: `${baseUrl}/${C.id}/${r.id}`,
    })),
    ...people.map((r) => ({
      id: r.id,
      kind: "person" as const,
      name: str(r.fields["Full Name"]) ?? str(r.fields["Primary Email"]) ?? "(unnamed)",
      detail: [str(r.fields["Internal Type"]), str(r.fields["Primary Email"])]
        .filter(Boolean)
        .join(" · ") || null,
      airtableUrl: `${baseUrl}/${P.id}/${r.id}`,
    })),
  ];
}
