// Server Actions for client-side portal contacts.
//
// NOTHING HERE SENDS EMAIL. Granting access flips People.Portal Access and
// stamps Portal Invited At; the magic-link mail needs an email provider that
// is not provisioned yet (spec 2026-08-06, §6). The UI says so rather than
// implying an invite went out.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import { listPeopleWithEmail } from "../retainer-contacts";
import {
  findByEmail,
  validateContact,
  type NewContactInput,
} from "../retainer-contact-rules";
import type { PortalRole } from "../retainer-types";

const PEOPLE = Tables.People;

export type ContactMutationResult<T = unknown> = ({ ok: true } & T) | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireRole("admin", "lead");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

function invalidate() {
  revalidateTag("airtable");
  revalidateTag("retainers:contacts");
}

export type AddContactInput = NewContactInput & {
  companyId: string;
  portalRole: PortalRole;
  grantAccess: boolean;
};

/**
 * Add a portal contact for a company.
 *
 * Matches an existing People record by email BEFORE creating one. This base
 * already has duplicate People records — CLAUDE.md lists them as an unresolved
 * blocker and lib/people.ts carries PERSON_OVERRIDES to work around them — and
 * this table is what the portal will authenticate against. A second record for
 * the same human means an ambiguous login.
 *
 * When a match is found the existing record is updated in place and `linked`
 * comes back true, so the UI can say what actually happened.
 */
export async function addRetainerContact(
  input: AddContactInput,
): Promise<ContactMutationResult<{ id: string; linked: boolean }>> {
  const denied = await gate();
  if (denied) return denied;

  const invalid = validateContact(input);
  if (invalid) return { error: invalid };
  if (!input.companyId) return { error: "A client is required." };

  try {
    const existing = findByEmail(await listPeopleWithEmail(), input.email);

    const portalFields: Record<string, unknown> = {
      "Portal Role": input.portalRole,
      "Portal Access": input.grantAccess,
    };
    if (input.grantAccess) portalFields["Portal Invited At"] = new Date().toISOString();

    if (existing) {
      // Re-point the company link rather than adding a second record. If they
      // were attached elsewhere this is the correction we want; the alternative
      // is a duplicate that breaks sign-in.
      await patchRecords(PEOPLE.id, [
        { id: existing.id, fields: { ...portalFields, Company: [input.companyId] } },
      ]);
      invalidate();
      return { ok: true, id: existing.id, linked: true };
    }

    const [created] = await createRecords(PEOPLE.id, [
      {
        fields: {
          "First Name": input.firstName.trim(),
          "Last Name": input.lastName.trim(),
          "Primary Email": input.email.trim(),
          Company: [input.companyId],
          Type: "External client/partner",
          ...portalFields,
        },
      },
    ]);
    invalidate();
    return { ok: true, id: created.id, linked: false };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Grant or revoke portal sign-in.
 *
 * Portal Invited At is stamped on the FIRST grant and never overwritten — it
 * records when they were first let in, and re-granting after a revoke should
 * not rewrite that history. Revoking leaves it alone for the same reason.
 */
export async function setContactPortalAccess(
  personId: string,
  granted: boolean,
  opts?: { alreadyInvited?: boolean },
): Promise<ContactMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    const fields: Record<string, unknown> = { "Portal Access": granted };
    if (granted && !opts?.alreadyInvited) {
      fields["Portal Invited At"] = new Date().toISOString();
    }
    await patchRecords(PEOPLE.id, [{ id: personId, fields }]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setContactPortalRole(
  personId: string,
  role: PortalRole,
): Promise<ContactMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(PEOPLE.id, [{ id: personId, fields: { "Portal Role": role } }]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Detach a contact from the company. Deliberately NOT a delete: a People
 * record carries payments, stories and quote links, and destroying it to
 * remove someone from a portal would be wildly disproportionate.
 */
export async function removeRetainerContact(
  personId: string,
): Promise<ContactMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    await patchRecords(PEOPLE.id, [
      { id: personId, fields: { Company: [], "Portal Access": false } },
    ]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
