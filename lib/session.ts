// Session helper. Resolves the current user via (in order):
//   1. DEV_PREVIEW / AUTH_BYPASS (synthetic Lee — dev or kill switch)
//   2. NextAuth Google OAuth session (primary, since the OAuth flip on 2026-05-18)
//   3. SAML session cookie (legacy fallback for any lingering sessions from the password era)
//
// Both surviving auth flows produce the same AppSession shape so all pages work unchanged.

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "./auth";
import type { AppRole } from "./auth";
import { SAML_COOKIE_NAME, verifySamlSession } from "./samlSession";
import { resolvePersonByEmail } from "./people";
import type { Permission } from "./permissions";
import { ALL_PERMISSIONS } from "./permissions";

const DEV_PREVIEW =
  process.env.NODE_ENV !== "production" && process.env.DEV_PREVIEW === "true";

// AUTH_BYPASS: kill switch that disables ALL auth (even in production).
// Returns the synthetic Lee admin session to everyone. Use only when SAML/OAuth
// are intentionally turned off and the app should be accessible without login.
const AUTH_BYPASS = process.env.AUTH_BYPASS === "true";

export type AppSession = {
  user: {
    email: string;
    name?: string | null;
    image?: string | null;
    role: AppRole;
    permissions: Permission[];
  };
} | null;

// Dev-only synthetic session used when DEV_PREVIEW or AUTH_BYPASS is set.
// Never reached in production — gated by env, not user input.
const SYNTHETIC_DEV_SESSION: AppSession = {
  user: {
    email: "dev@airvues.com",
    name: "Dev Admin",
    role: "admin",
    permissions: [...ALL_PERMISSIONS],
  },
};

async function loadPermissions(email: string): Promise<Permission[]> {
  try {
    const person = await resolvePersonByEmail(email);
    if (process.env.DEBUG_PERMISSIONS === "true") {
      console.log("[session] loadPermissions", {
        email,
        matched: !!person,
        permissions: person?.permissions ?? [],
      });
    }
    return person?.permissions ?? [];
  } catch (err) {
    if (process.env.DEBUG_PERMISSIONS === "true") {
      console.warn("[session] loadPermissions error", email, (err as Error).message);
    }
    return [];
  }
}

export const getAppSession = cache(async (): Promise<AppSession> => {
  if (DEV_PREVIEW || AUTH_BYPASS) {
    return SYNTHETIC_DEV_SESSION;
  }

  // 1. NextAuth Google OAuth — primary auth path
  try {
    const s = await auth();
    if (s?.user?.email && (s.user as { role?: AppRole }).role) {
      const role = (s.user as { role: AppRole }).role;
      const permissions = await loadPermissions(s.user.email);
      return {
        user: {
          email: s.user.email,
          name: s.user.name,
          image: s.user.image,
          role,
          permissions,
        },
      };
    }
  } catch {
    // fall through to SAML cookie
  }

  // 2. SAML cookie — legacy fallback. Anyone still holding a SAML cookie from a
  //    previous password session continues to work until it expires.
  try {
    const cookieStore = await cookies();
    const samlToken = cookieStore.get(SAML_COOKIE_NAME)?.value;
    if (samlToken) {
      const samlSession = await verifySamlSession(samlToken);
      if (samlSession) {
        const permissions = await loadPermissions(samlSession.email);
        return {
          user: {
            email: samlSession.email,
            name: samlSession.name,
            role: samlSession.role,
            permissions,
          },
        };
      }
    }
  } catch {
    // no session
  }

  return null;
});

export const isDevPreview = DEV_PREVIEW || AUTH_BYPASS;
