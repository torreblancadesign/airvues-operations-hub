// Sign + verify the SAML session cookie. Separate from NextAuth's cookie so both
// flows can coexist during transition. Uses jose (already a NextAuth peer dep).
import "server-only";

import { SignJWT, jwtVerify } from "jose";
import type { SamlRole } from "./saml";

export const SAML_COOKIE_NAME = "airvues-ops-saml";
const ISSUER = "airvues-ops";
const AUDIENCE = "airvues-ops";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type SamlSession = {
  email: string;
  name: string | null;
  role: SamlRole;
};

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET env var is required for SAML session signing");
  return new TextEncoder().encode(s);
}

export async function signSamlSession(session: SamlSession): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySamlSession(token: string): Promise<SamlSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE });
    if (
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      !["admin", "editor", "viewer"].includes(payload.role)
    ) {
      return null;
    }
    return {
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
      role: payload.role as SamlRole,
    };
  } catch {
    return null;
  }
}

export const samlCookieOptions = {
  name: SAML_COOKIE_NAME,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
