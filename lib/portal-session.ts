// Resolving the current portal visitor.
//
// THE RULE: a valid cookie is not enough. Every call re-reads the People record
// and re-checks Portal Access and the Company link, so revoking someone in the
// ops app locks them out on their very next request instead of whenever their
// cookie happens to expire. Airtable is the authority; the cookie only says
// which record to go and check.
import "server-only";

import { cookies } from "next/headers";
import { getRecord } from "./airtable";
import { Tables } from "./schema";
import { PORTAL_COOKIE, verifyPortalSession } from "./portal-token";
import type { PortalRole } from "./retainer-types";

const PEOPLE = Tables.People;

export type PortalSession = {
  personId: string;
  /** The tenant key. EVERY portal query filters on this. No exceptions. */
  companyId: string;
  email: string;
  name: string;
  role: PortalRole;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** The signed-in portal visitor, or null. Null means "show the sign-in page". */
export async function getPortalSession(): Promise<PortalSession | null> {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyPortalSession(token);
  if (!claims) return null;

  let rec;
  try {
    rec = await getRecord<Record<string, unknown>>(PEOPLE.id, claims.personId);
  } catch {
    // Deleted record, or Airtable is down. Fail closed either way.
    return null;
  }

  const f = rec.fields;
  if (f["Portal Access"] !== true) return null;

  const companyId =
    Array.isArray(f["Company"]) && typeof f["Company"][0] === "string"
      ? (f["Company"][0] as string)
      : null;
  if (!companyId) return null;

  // The company on the record wins over the one baked into the cookie. If ops
  // moved this person to a different client, an old cookie must not keep
  // showing them their previous client's retainers.
  return {
    personId: claims.personId,
    companyId,
    email: str(f["Primary Email"]) ?? claims.email,
    name: str(f["Full Name"]) ?? "there",
    role: (str(f["Portal Role"]) as PortalRole | null) ?? "Member",
  };
}

/** Stamp the last-seen time. Best-effort — never block a page render on it. */
export async function touchPortalLogin(personId: string): Promise<void> {
  try {
    const { patchRecords } = await import("./airtable");
    await patchRecords(PEOPLE.id, [
      { id: personId, fields: { "Portal Last Login": new Date().toISOString() } },
    ]);
  } catch {
    /* ignore */
  }
}
