// Server-only reads for client-side portal contacts.
// Do NOT import from a client component — this pulls in lib/airtable.ts.
import "server-only";

import { listRecords, listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import type { PortalRole, RetainerContact } from "./retainer-types";

const PEOPLE = Tables.People;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function firstLink(v: unknown): string | null {
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
}

const FIELDS = [
  PEOPLE.fields["Full Name"].id,
  PEOPLE.fields["First Name"].id,
  PEOPLE.fields["Last Name"].id,
  PEOPLE.fields["Primary Email"].id,
  PEOPLE.fields["Company"].id,
  PEOPLE.fields["Portal Access"].id,
  PEOPLE.fields["Portal Role"].id,
  PEOPLE.fields["Portal Last Login"].id,
  PEOPLE.fields["Portal Invited At"].id,
];

function toContact(r: { id: string; fields: Record<string, unknown> }): RetainerContact {
  const f = r.fields;
  const first = str(f["First Name"]);
  const last = str(f["Last Name"]);
  return {
    id: r.id,
    // Full Name is a formula (CONCATENATE of the two below) and can be blank
    // on a half-filled record, so fall back rather than render an empty row.
    // `??` never reaches the last branch: join() returns "" for an empty list,
    // which isn't nullish, so a blank record rendered as an empty name.
    name:
      str(f["Full Name"]) ??
      ([first, last].filter(Boolean).join(" ") || "(unnamed)"),
    firstName: first,
    lastName: last,
    email: str(f["Primary Email"]),
    companyId: firstLink(f["Company"]),
    portalAccess: f["Portal Access"] === true,
    portalRole: (str(f["Portal Role"]) as PortalRole | null) ?? null,
    portalLastLogin: str(f["Portal Last Login"]),
    portalInvitedAt: str(f["Portal Invited At"]),
  };
}

/**
 * Everyone linked to this company.
 *
 * `fresh: true` bypasses the 5-minute cache. MUTATIONS MUST PASS IT — the
 * duplicate check reads this list, and a stale read is exactly how a second
 * People record for the same human gets created.
 */
export async function listContactsForCompany(
  companyId: string | null,
  opts?: { fresh?: boolean },
): Promise<RetainerContact[]> {
  if (!companyId) return [];
  const read = opts?.fresh ? listRecords : listRecordsCached;
  const rows = await read<Record<string, unknown>>(
    PEOPLE.id,
    { fields: FIELDS },
    opts?.fresh ? undefined : ["retainers:contacts"],
  );
  return rows.map(toContact).filter((c) => c.companyId === companyId);
}

/**
 * Every person carrying an email, for the cross-company duplicate check.
 *
 * Deliberately NOT scoped to one company: the human we are about to create may
 * already exist against a different company, or against none at all, and
 * creating a second record for them is the failure this guards.
 */
export async function listPeopleWithEmail(): Promise<RetainerContact[]> {
  const rows = await listRecords<Record<string, unknown>>(PEOPLE.id, {
    filterByFormula: "NOT({Archived})",
    fields: FIELDS,
  });
  return rows.map(toContact).filter((c) => c.email !== null);
}
