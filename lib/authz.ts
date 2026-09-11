// Server-side authorization gate.
// Pattern: call requireRole("admin", "lead") at the top of every Server Action that mutates.
// Today (shared password) every signed-in user has role=admin so the gate passes.
// After Google OAuth + ALLOWED_USERS lands, roles per email become real.
import "server-only";

import { AppSession, getAppSession } from "./session";
import { canRoleDelete } from "./permissions";
import type { AppRole } from "./auth";

export class AuthzError extends Error {
  constructor(
    public reason: "unauthenticated" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export async function requireRole(
  ...allowed: AppRole[]
): Promise<NonNullable<AppSession>> {
  const session = await getAppSession();
  if (!session?.user) {
    throw new AuthzError("unauthenticated", "Not signed in");
  }
  if (!allowed.includes(session.user.role)) {
    throw new AuthzError(
      "forbidden",
      `Role ${session.user.role} not in allowed: ${allowed.join(", ")}`,
    );
  }
  return session;
}

export async function getCurrentRole(): Promise<AppRole | null> {
  const session = await getAppSession();
  return session?.user.role ?? null;
}

// Edit rights are no longer gated by role. Any signed-in user can mutate;
// what each user can see/reach is controlled by Airtable People.Permissions
// (see lib/permissions.ts + lib/page-guard.ts).
export async function canMutate(): Promise<boolean> {
  const session = await getAppSession();
  return !!session?.user;
}

// ---------------------------------------------------------------------------
// Deleting is the ONE mutation still gated by role. Every other write is open
// to any signed-in user (see canMutate above) because edits are reversible and
// the audit trail is the record itself. A delete is not reversible: a hard
// delete is gone from Airtable, and even a soft one hides a record other people
// are looking for. So it stays with admin + lead.
//
// The role list lives in lib/permissions.ts because the nav (a client bundle)
// needs it too; this file stays the only place that reads the session.
export async function canDelete(): Promise<boolean> {
  const session = await getAppSession();
  return canRoleDelete(session?.user.role);
}

/**
 * Gate for every delete/archive Server Action.
 *
 * Returns a ready-to-surface `{ error }` instead of throwing, because that is
 * the shape every mutation in lib/mutations already returns to the client, and
 * the message is written for a human reading a toast — not "forbidden".
 */
export async function deleteGate(): Promise<{ error: string } | null> {
  const session = await getAppSession();
  if (!session?.user) return { error: "Your session has ended. Sign in again." };
  if (!canRoleDelete(session.user.role)) {
    return { error: "Only admins and leads can delete. Ask one of them to do it." };
  }
  return null;
}

// Server-Action / route-handler gate: throws AuthzError if there is no session.
// Use this at the top of every mutation instead of requireRole(...).
export async function requireSignedIn(): Promise<NonNullable<AppSession>> {
  const session = await getAppSession();
  if (!session?.user) {
    throw new AuthzError("unauthenticated", "Not signed in");
  }
  return session;
}
