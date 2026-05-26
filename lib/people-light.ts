// Lightweight People list — used by the New Invoice payer picker.
// Returns external/client people that are reasonable invoice payers.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type PayerOption = {
  id: string;
  label: string;
  email: string | null;
  company: string | null;
};

export async function listPayerOptions(): Promise<PayerOption[]> {
  const t = Tables.People;
  const records = await listRecordsCached<{
    "Full Name"?: string;
    "First Name"?: string;
    "Last Name"?: string;
    "Primary Email"?: string;
    "Company"?: string[];
    "Type"?: string;
  }>(
    t.id,
    {
      fields: [
        t.fields["Full Name"].id,
        t.fields["First Name"].id,
        t.fields["Last Name"].id,
        t.fields["Primary Email"].id,
        t.fields["Company"].id,
        t.fields["Type"].id,
      ],
    },
    ["people:payer-options"],
  );

  return records
    .map((r) => {
      const f = r.fields;
      const full =
        (f["Full Name"] as string) ||
        [f["First Name"], f["Last Name"]].filter(Boolean).join(" ") ||
        "(unnamed)";
      return {
        id: r.id,
        label: full.trim(),
        email: (f["Primary Email"] as string) ?? null,
        // Company link returns recIds; we don't resolve names here (kept light).
        company: null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
