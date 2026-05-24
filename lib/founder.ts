// Per-founder profile (Retirement Number + Ownership Percentage from People).
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { getAppSession } from "./session";
import { resolvePersonByEmail } from "./people";

export type FounderProfile = {
  personId: string | null;
  name: string | null;
  retirementNumber: number | null;
  ownershipPercentage: number | null; // normalized to 0..1
};

export async function getFounderProfile(): Promise<FounderProfile> {
  const session = await getAppSession();
  const email = session?.user?.email ?? null;
  const person = await resolvePersonByEmail(email);
  if (!person) {
    return { personId: null, name: null, retirementNumber: null, ownershipPercentage: null };
  }

  const records = await listRecordsCached<{
    "Retirement Number"?: number;
    "Ownership Percentage"?: number;
  }>(
    Tables.People.id,
    {
      fields: ["Retirement Number", "Ownership Percentage"],
      filterByFormula: `RECORD_ID() = "${person.id}"`,
    },
    [`founder:profile:${person.id}`],
  );

  const f = records[0]?.fields ?? {};
  const retirement = typeof f["Retirement Number"] === "number" ? f["Retirement Number"]! : null;
  const rawOwn = typeof f["Ownership Percentage"] === "number" ? f["Ownership Percentage"]! : null;
  // Airtable percent fields return decimals (0.6); guard against whole-percent (60).
  const ownership = rawOwn === null ? null : rawOwn > 1 ? rawOwn / 100 : rawOwn;

  return {
    personId: person.id,
    name: person.fullName,
    retirementNumber: retirement,
    ownershipPercentage: ownership,
  };
}
