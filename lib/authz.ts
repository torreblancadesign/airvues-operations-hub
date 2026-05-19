// Server-side authorization gate.
// Pattern: call requireRole("admin", "lead") at the top of every Server Action that mutates.
// Today (shared password) every signed-in user has role=admin so the gate passes.
// After Google OAuth + ALLOWED_USERS lands, roles per email become real.
import "server-only";

import { AppSession, getAppSession } from "./session";
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

// Roles that can write to Airtable. "editor" is a legacy synonym for "lead".
const MUTATE_ROLES: AppRole[] = ["admin", "lead", "editor"];

export async function canMutate(): Promise<boolean> {
  const role = await getCurrentRole();
  return role !== null && MUTATE_ROLES.includes(role);
}
