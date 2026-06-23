// NextAuth v5 — Google OAuth + email allowlist.
// We do NOT use Google's `hd` Workspace domain hint because some admins sign in
// with personal Gmail addresses. The `ALLOWED_USERS` env JSON is the hard gate —
// only allowlisted emails get a session. Per docs/auth-architecture-2026-05-17.md.

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

// 4-role model defined in docs/auth-architecture-2026-05-17.md.
// Legacy values "editor" + "viewer" remain valid so existing ALLOWED_USERS JSON entries
// keep working; treat "editor" as a synonym for "lead" until the env JSON is migrated.
export type AppRole = "admin" | "lead" | "engineer" | "client" | "editor" | "viewer";

// AllowedUsers entries are EITHER per-email (exact match) OR per-domain (wildcard).
// Email matches beat domain matches. This lets you say "anyone on airvues.com is at least
// an engineer, except these specific people who get a higher role." New hires auto-onboard
// once their @airvues.com Workspace account exists — no env var edit needed.
type AllowedEntry =
  | { kind: "email"; email: string; role: AppRole }
  | { kind: "domain"; domain: string; role: AppRole };

function loadAllowedUsers(): AllowedEntry[] {
  const raw = process.env.ALLOWED_USERS;
  if (!raw) {
    // Throwing at module scope crashes Next's prerender pass (page-data collection).
    // Allow empty in build/dev; sign-in is gated separately by findRole returning null.
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      console.error("[auth] ALLOWED_USERS env is not set — all sign-ins will be denied.");
    }
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("ALLOWED_USERS must be a JSON array");
    const entries: AllowedEntry[] = [];
    for (const u of parsed) {
      if (!u || typeof u.role !== "string") continue;
      if (typeof u.email === "string") {
        entries.push({ kind: "email", email: u.email.toLowerCase(), role: u.role as AppRole });
      } else if (typeof u.domain === "string") {
        entries.push({ kind: "domain", domain: u.domain.toLowerCase(), role: u.role as AppRole });
      }
    }
    return entries;
  } catch (err) {
    console.error(`[auth] ALLOWED_USERS is not valid JSON: ${(err as Error).message}`);
    return [];
  }
}

let _allowedUsers: AllowedEntry[] | null = null;
function getAllowedUsers(): AllowedEntry[] {
  if (_allowedUsers === null) _allowedUsers = loadAllowedUsers();
  return _allowedUsers;
}

function findRole(email: string | null | undefined): AppRole | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  // 1. Exact email match wins
  const emailMatch = allowedUsers.find((u) => u.kind === "email" && u.email === lower);
  if (emailMatch) return emailMatch.role;
  // 2. Domain match fallback (anyone on the Workspace gets the default role)
  const atIdx = lower.indexOf("@");
  if (atIdx === -1) return null;
  const domain = lower.slice(atIdx + 1);
  const domainMatch = allowedUsers.find((u) => u.kind === "domain" && u.domain === domain);
  return domainMatch ? domainMatch.role : null;
}

declare module "next-auth" {
  interface Session {
    user: {
      role: AppRole;
    } & DefaultSession["user"];
    accessToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: AppRole;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

// Refresh an expired Google access token using the refresh_token from initial consent.
// Returns the new token + expiry, or null on failure (caller should treat as no-token).
async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
} | null> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.warn("[auth.refresh] Google rejected refresh token:", resp.status);
      return null;
    }
    return await resp.json();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[auth.refresh] refresh error:", (e as Error).message);
    return null;
  }
}

// Scopes requested from Google. openid+email+profile are default; we add
// calendar.readonly + gmail.readonly so the TopBar can surface meetings + inbox.
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Trust the x-forwarded-host header from Vercel's proxy. Without this (and
  // without AUTH_URL), NextAuth v5 falls back to http://localhost:3000 when
  // building OAuth callback URLs — which sends users to localhost after Google
  // consent. Safe on Vercel because the platform sets x-forwarded-host.
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          // `consent` forces Google to RE-ISSUE a new access_token + refresh_token
          // every sign-in. Without this, returning users skip consent and Google
          // does NOT return tokens, so token.accessToken stays undefined.
          prompt: "consent",
          scope: GOOGLE_SCOPES,
          access_type: "offline",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      // Hard gate: must be on the allowlist. If not, deny — even if Google says they're authenticated.
      const role = findRole(user.email);
      if (!role) {
        console.warn(`[auth] Sign-in denied for ${user.email} — not on ALLOWED_USERS allowlist.`);
        return false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // First sign-in: persist role + tokens.
      if (user?.email) {
        const role = findRole(user.email);
        if (role) token.role = role;
      }
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
        return token;
      }

      // Subsequent calls: if the access_token is still valid (with 60s buffer), use it.
      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60_000
      ) {
        return token;
      }

      // Expired (or about to). Try to refresh.
      if (token.refreshToken) {
        const refreshed = await refreshGoogleAccessToken(token.refreshToken);
        if (refreshed) {
          token.accessToken = refreshed.access_token;
          token.accessTokenExpires = Date.now() + refreshed.expires_in * 1000;
          // Google sometimes rotates the refresh token; keep the new one if provided
          if (refreshed.refresh_token) {
            token.refreshToken = refreshed.refresh_token;
          }
          delete token.error;
        } else {
          // Refresh failed — mark the token so the UI can prompt re-auth
          token.error = "RefreshFailed";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.role && session.user) {
        session.user.role = token.role as AppRole;
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken;
        session.accessTokenExpires = token.accessTokenExpires;
      }
      if (token.error) {
        session.error = token.error;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
});

/**
 * Server-side guard — call at the top of any Server Action / route handler that requires a role.
 * Throws if the session is missing or doesn't have the required role.
 */
export async function requireRole(...allowed: AppRole[]) {
  const session = await auth();
  if (!session?.user?.role) {
    throw new Error("Unauthenticated");
  }
  if (!allowed.includes(session.user.role)) {
    throw new Error(`Forbidden — requires role ${allowed.join("|")}, got ${session.user.role}`);
  }
  return session;
}
