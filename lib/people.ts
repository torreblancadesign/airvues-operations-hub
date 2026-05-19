// Resolve a signed-in email to the matching People record in Airtable.
// Email match is exact, case-insensitive, against People.Primary Email.
// PERSON_OVERRIDES env JSON (optional) lets us pin email → recId for the
// duplicate-People window (Bracho×2, Jose×2 etc — per the May 2026 audit).
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type ResolvedPerson = {
  id: string;
  email: string;
  firstName: string;
  fullName: string;
  role: string | null;
  internalType: string | null;
  status: string | null;
};

type PersonRow = {
  "Primary Email"?: string;
  "Full Name"?: string;
  "First Name"?: string;
  "Last Name"?: string;
  Role?: string;
  "Internal Type"?: string;
  Status?: string;
  Type?: string;
};

function parseOverrides(): Record<string, string> {
  const raw = process.env.PERSON_OVERRIDES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => [k.toLowerCase(), v as string]),
    );
  } catch {
    return {};
  }
}

const OVERRIDES = parseOverrides();

const SHARED_MAILBOXES = new Set(["support@airvues.com", "noreply@airvues.com"]);

export async function resolvePersonByEmail(
  email: string | null | undefined,
): Promise<ResolvedPerson | null> {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (SHARED_MAILBOXES.has(lower)) return null;

  const overrideId = OVERRIDES[lower];

  const records = await listRecordsCached<PersonRow>(
    Tables.People.id,
    {
      fields: [
        Tables.People.fields["Primary Email"].id,
        Tables.People.fields["Full Name"].id,
        Tables.People.fields["First Name"].id,
        Tables.People.fields["Last Name"].id,
        Tables.People.fields["Role"].id,
        Tables.People.fields["Internal Type"].id,
        Tables.People.fields["Status"].id,
        Tables.People.fields["Type"].id,
      ],
      filterByFormula: overrideId
        ? `RECORD_ID() = "${overrideId}"`
        : `LOWER({Primary Email}) = "${lower}"`,
    },
    [`people:by-email:${lower}`],
  );

  if (records.length === 0) return null;

  // Pick the canonical record per the architecture spec tiebreakers:
  // 1) Status = Active; 2) Type ∈ Internal/Internal team member; 3) earliest createdTime
  const ranked = [...records].sort((a, b) => {
    const sa = a.fields.Status === "Active" ? 0 : 1;
    const sb = b.fields.Status === "Active" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const ta = a.fields.Type;
    const tb = b.fields.Type;
    const ia = ta === "Internal" || ta === "Internal team member" ? 0 : 1;
    const ib = tb === "Internal" || tb === "Internal team member" ? 0 : 1;
    if (ia !== ib) return ia - ib;
    return a.createdTime.localeCompare(b.createdTime);
  });

  const winner = ranked[0];
  const f = winner.fields;
  const fullName =
    (f["Full Name"] as string) ||
    [f["First Name"], f["Last Name"]].filter(Boolean).join(" ").trim() ||
    lower;
  const firstName = (f["First Name"] as string) || fullName.split(/\s+/)[0] || lower;

  return {
    id: winner.id,
    email: lower,
    firstName,
    fullName,
    role: (f["Role"] as string) ?? null,
    internalType: (f["Internal Type"] as string) ?? null,
    status: (f["Status"] as string) ?? null,
  };
}
