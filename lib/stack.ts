// Stack page data layer — internal SaaS subscriptions.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  source: string | null;       // Business Checking / Business Credit Card
  cadence: string | null;      // Monthly / Yearly
  startDate: string | null;
  endDate: string | null;
  monthlyEquivalent: number;   // computed for unified burn
  airtableUrl: string;
};

export async function listAllSubscriptions(): Promise<Subscription[]> {
  const t = Tables.Subscriptions;
  const records = await listRecordsCached<{
    Name?: string;
    Amount?: number;
    Source?: string;
    Type?: string;
    "Start Date"?: string;
    "End Date"?: string;
  }>(
    t.id,
    {
      fields: [
        t.fields["Name"].id,
        t.fields["Amount"].id,
        t.fields["Source"].id,
        t.fields["Type"].id,
        t.fields["Start Date"].id,
        t.fields["End Date"].id,
      ],
    },
    ["stack:all"],
  );

  return records.map((r) => {
    const f = r.fields;
    const amount = (f["Amount"] as number) ?? 0;
    const cadence = (f["Type"] as string) ?? null;
    const monthlyEquivalent = cadence === "Yearly" ? amount / 12 : amount;
    return {
      id: r.id,
      name: (f["Name"] as string) ?? "(unnamed)",
      amount,
      source: (f["Source"] as string) ?? null,
      cadence,
      startDate: (f["Start Date"] as string) ?? null,
      endDate: (f["End Date"] as string) ?? null,
      monthlyEquivalent,
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${t.id}/${r.id}`,
    };
  });
}
