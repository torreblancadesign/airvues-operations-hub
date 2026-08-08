// Rules for client-side portal contacts. PURE — no I/O, no "server-only".
//
// The dedupe rule here matters more than it looks. lib/people.ts already
// carries PERSON_OVERRIDES to work around People records that exist twice, and
// CLAUDE.md lists those duplicates as an unresolved blocker. A contact form
// that creates a record without looking first would add to that pile, on the
// exact table the portal will authenticate against.

import type { RetainerContact } from "./retainer-types";

/** Normalised email for comparison. Airtable stores whatever was typed. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * An existing person with this email, or null.
 *
 * Case- and whitespace-insensitive: "Flavio@GracieBarra.com " and
 * "flavio@graciebarra.com" are the same human, and treating them as two is how
 * a duplicate gets created.
 */
export function findByEmail<T extends { email: string | null }>(
  people: T[],
  email: string,
): T | null {
  const target = normalizeEmail(email);
  if (!target) return null;
  return people.find((p) => normalizeEmail(p.email) === target) ?? null;
}

export type ContactReadiness = "active" | "invited" | "no-access" | "no-email";

/**
 * Whether this contact could actually sign in to the portal today.
 *
 * Portal sign-in requires an email AND Portal Access AND a Company link — so a
 * contact with access but no email is not "ready", it is broken, and saying so
 * here is cheaper than discovering it when the client cannot log in.
 */
export function readinessOf(c: RetainerContact): ContactReadiness {
  if (normalizeEmail(c.email) === "") return "no-email";
  if (!c.portalAccess) return "no-access";
  return c.portalLastLogin ? "active" : "invited";
}

const RANK: Record<ContactReadiness, number> = {
  active: 0,
  invited: 1,
  "no-access": 2,
  "no-email": 3,
};

/**
 * Owners above members, people who can sign in above people who cannot, then
 * alphabetical. Puts the person to contact at the top and the broken records
 * at the bottom where they read as a to-do list.
 */
export function sortContacts(contacts: RetainerContact[]): RetainerContact[] {
  return [...contacts].sort((a, b) => {
    const owner = Number(b.portalRole === "Owner") - Number(a.portalRole === "Owner");
    if (owner !== 0) return owner;
    const ready = RANK[readinessOf(a)] - RANK[readinessOf(b)];
    if (ready !== 0) return ready;
    return a.name.localeCompare(b.name);
  });
}

export type NewContactInput = {
  firstName: string;
  lastName: string;
  email: string;
};

/** First problem with a new contact, or null. */
export function validateContact(input: NewContactInput): string | null {
  if (input.firstName.trim() === "") return "First name is required.";
  const email = input.email.trim();
  if (email === "") return "An email is required — it is how they sign in.";
  // Deliberately loose. Airtable is the system of record and a stricter regex
  // rejects valid addresses more often than it catches typos.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email does not look valid.";
  return null;
}
