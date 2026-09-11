// Magic-link tokens and the portal session cookie.
//
// Two different lifetimes on purpose:
//   - the LINK is a bearer credential sitting in a chat message or an inbox,
//     so it lives 30 minutes and is useless afterwards;
//   - the SESSION is behind an httpOnly cookie on one browser, so it lives 8
//     hours like any normal login.
//
// Neither is trusted on its own. Every portal page re-reads People and re-checks
// Portal Access, so revoking access locks someone out on their next request
// rather than whenever their cookie happens to expire.
import "server-only";
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "airvues-ops";
const LINK_AUDIENCE = "airvues-portal-link";
const SESSION_AUDIENCE = "airvues-portal-session";

export const LINK_TTL_SECONDS = 30 * 60;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export const PORTAL_COOKIE = "airvues-portal-session";

/**
 * Signing key. Prefers a dedicated secret so portal access can be revoked
 * wholesale — rotating it invalidates every outstanding link and session
 * without touching ops sign-in — and falls back to AUTH_SECRET so this works
 * before anyone adds new env config.
 */
function key(): Uint8Array | null {
  const raw = process.env.PORTAL_SESSION_SECRET || process.env.AUTH_SECRET;
  return raw ? new TextEncoder().encode(raw) : null;
}

export type PortalClaims = {
  /** People record id. The portal's notion of "who". */
  personId: string;
  /** Company record id. The tenant key every portal query filters on. */
  companyId: string;
  email: string;
};

async function sign(claims: PortalClaims, audience: string, ttl: number): Promise<string | null> {
  const k = key();
  if (!k) return null;
  return await new SignJWT({ companyId: claims.companyId, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setSubject(claims.personId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(k);
}

async function verify(token: string, audience: string): Promise<PortalClaims | null> {
  const k = key();
  if (!k) return null;
  try {
    const { payload } = await jwtVerify(token, k, { issuer: ISSUER, audience });
    const personId = payload.sub;
    const companyId = payload.companyId;
    const email = payload.email;
    if (
      typeof personId !== "string" ||
      typeof companyId !== "string" ||
      typeof email !== "string"
    ) {
      return null;
    }
    return { personId, companyId, email };
  } catch {
    return null;
  }
}

/** Mint a one-click sign-in link token. Gate the CALLER on admin/lead. */
export function signPortalLinkToken(claims: PortalClaims): Promise<string | null> {
  return sign(claims, LINK_AUDIENCE, LINK_TTL_SECONDS);
}

export function verifyPortalLinkToken(token: string): Promise<PortalClaims | null> {
  return verify(token, LINK_AUDIENCE);
}

/**
 * Mint the session cookie value.
 *
 * A separate audience from the link token, so a captured link cannot be
 * replayed as a session and a leaked session cookie cannot be handed round as
 * a link.
 */
export function signPortalSession(claims: PortalClaims): Promise<string | null> {
  return sign(claims, SESSION_AUDIENCE, SESSION_TTL_SECONDS);
}

export function verifyPortalSession(token: string): Promise<PortalClaims | null> {
  return verify(token, SESSION_AUDIENCE);
}

export function portalSecretConfigured(): boolean {
  return key() !== null;
}
