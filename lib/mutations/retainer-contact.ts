// Server Actions for client-side portal contacts.
//
// NOTHING HERE SENDS EMAIL. Granting access flips People.Portal Access and
// stamps Portal Invited At; the magic-link mail needs an email provider that
// is not provisioned yet (spec 2026-08-06, §6). The UI says so rather than
// implying an invite went out.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords, getRecord, patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import { listPeopleWithEmail } from "../retainer-contacts";
import {
  appendHistory,
  findByEmail,
  validateContact,
  type NewContactInput,
} from "../retainer-contact-rules";
import { getAppSession } from "../session";
import { LINK_TTL_SECONDS, signPortalLinkToken } from "../portal-token";
import type { PortalRole } from "../retainer-types";

const PEOPLE = Tables.People;

export type ContactMutationResult<T = unknown> =
  | ({ ok: true } & T)
  /** `needsMoveConfirm` asks the caller to re-submit with confirmMove. */
  | { error: string; needsMoveConfirm?: boolean };

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


/** Who is making the change, for the history line. */
async function actor(): Promise<string | null> {
  try {
    const session = await getAppSession();
    return session?.user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the current history and return the field payload with one line added.
 *
 * Read-modify-write, so it is last-write-wins under concurrency. Two ops users
 * changing the same contact in the same second could lose one line; the
 * alternative is a separate audit table, which is the deferred mutation-log
 * work in CLAUDE.md rather than something to invent here.
 */
async function withHistory(
  personId: string,
  fields: Record<string, unknown>,
  action: string,
  detail?: string | null,
): Promise<Record<string, unknown>> {
  let existing: string | null = null;
  try {
    const rec = await getRecord<Record<string, unknown>>(PEOPLE.id, personId);
    const v = rec.fields["Portal History"];
    existing = typeof v === "string" ? v : null;
  } catch {
    // A history read failure must not block the access change itself — but it
    // must not REWRITE the field either. appendHistory(null, …) returns only
    // the new line, so patching it here would erase every prior entry on one
    // transient 429. Leave the field untouched and lose a single entry.
    return { ...fields };
  }
  return {
    ...fields,
    "Portal History": appendHistory(existing, {
      at: new Date(),
      actor: await actor(),
      action,
      detail,
    }),
  };
}

export type AddContactInput = NewContactInput & {
  companyId: string;
  portalRole: PortalRole;
  grantAccess: boolean;
  /**
   * Proceed even though this email already belongs to a DIFFERENT client.
   * Off by default: the move is destructive and invisible, so it has to be
   * asked for. See the guard in addRetainerContact.
   */
  confirmMove?: boolean;
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

    // Re-pointing Company is not a harmless link edit. getPortalSession reads
    // Company live off the People record, so moving someone already attached
    // to another client instantly repoints their EXISTING portal session at
    // the new client's data — and a typo'd email does the same to an Airvues
    // engineer's record. Legitimate when it's a genuine correction, which is
    // why it's a confirmation rather than a refusal.
    if (
      existing &&
      existing.companyId &&
      existing.companyId !== input.companyId &&
      !input.confirmMove
    ) {
      return {
        error:
          "That email already belongs to a contact at another client. Moving them would repoint any portal session they already have. Confirm to move them.",
        needsMoveConfirm: true,
      };
    }

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
        {
          id: existing.id,
          fields: await withHistory(
            existing.id,
            { ...portalFields, Company: [input.companyId] },
            `Linked to client as ${input.portalRole}`,
            input.grantAccess ? "portal access granted" : "no portal access",
          ),
        },
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
          "Portal History": appendHistory(null, {
            at: new Date(),
            actor: await actor(),
            action: `Contact created as ${input.portalRole}`,
            detail: input.grantAccess ? "portal access granted" : "no portal access",
          }),
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
  opts?: { alreadyInvited?: boolean; reason?: string },
): Promise<ContactMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    const reason = opts?.reason?.trim() || null;
    const fields: Record<string, unknown> = { "Portal Access": granted };
    if (granted && !opts?.alreadyInvited) {
      fields["Portal Invited At"] = new Date().toISOString();
    }
    await patchRecords(PEOPLE.id, [
      {
        id: personId,
        fields: await withHistory(
          personId,
          fields,
          granted ? "Portal access granted" : "Portal access revoked",
          reason,
        ),
      },
    ]);
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
    await patchRecords(PEOPLE.id, [
      {
        id: personId,
        fields: await withHistory(personId, { "Portal Role": role }, `Role changed to ${role}`),
      },
    ]);
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
  opts?: { companyName?: string | null; reason?: string },
): Promise<ContactMutationResult> {
  const denied = await gate();
  if (denied) return denied;

  try {
    const where = opts?.companyName?.trim() || "the client";
    await patchRecords(PEOPLE.id, [
      {
        id: personId,
        fields: await withHistory(
          personId,
          { Company: [], "Portal Access": false },
          `Detached from ${where}`,
          // The company link is cleared, so this line is the ONLY remaining
          // record that this person ever belonged to that client.
          opts?.reason?.trim() || "no reason given",
        ),
      },
    ]);
    invalidate();
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Mint a one-click sign-in link for a contact.
 *
 * Returns the URL for ops to hand over by whatever channel they already use.
 * Nothing is emailed — the provider is not wired up yet — so this is the
 * interim path, and the link is deliberately short-lived because it is a
 * bearer credential the moment it leaves this screen.
 *
 * admin/lead only. Anyone who can mint one of these can sign in as a client.
 */
export async function createPortalSignInLink(
  personId: string,
): Promise<ContactMutationResult<{ url: string; expiresInMinutes: number }>> {
  const denied = await gate();
  if (denied) return denied;

  try {
    const rec = await getRecord<Record<string, unknown>>(PEOPLE.id, personId);
    const f = rec.fields;

    if (f["Portal Access"] !== true) {
      return { error: "Grant portal access first — a link would be rejected at sign-in." };
    }
    const email = typeof f["Primary Email"] === "string" ? f["Primary Email"].trim() : "";
    if (!email) return { error: "This contact has no email, so there is nobody to sign in as." };

    const company = f["Company"];
    const companyId =
      Array.isArray(company) && typeof company[0] === "string" ? company[0] : null;
    if (!companyId) {
      return { error: "This contact is not linked to a client, so nothing could be scoped." };
    }

    const token = await signPortalLinkToken({ personId, companyId, email });
    if (!token) {
      return { error: "No signing secret configured. Set PORTAL_SESSION_SECRET or AUTH_SECRET." };
    }

    const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    await patchRecords(PEOPLE.id, [
      {
        id: personId,
        fields: await withHistory(personId, {}, "Sign-in link issued", "handed over manually"),
      },
    ]);
    invalidate();

    return {
      ok: true,
      url: `${base}/portal/verify?t=${token}`,
      expiresInMinutes: Math.round(LINK_TTL_SECONDS / 60),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
