// Signed SSO token for auto-authenticating into the airvues-quote app.
// The token proves "airvues-ops says this visitor is {email} for {quoteId}".
// Verified on the quote app side with the same QUOTE_SSO_SECRET.
import "server-only";
import { SignJWT } from "jose";

const ISSUER = "airvues-ops";
const AUDIENCE = "airvues-quote";
const TTL_SECONDS = 10 * 60; // 10 minutes — long enough for a click, short enough to not be a share-vector.

let _keyBytes: Uint8Array | null = null;
function getKey(): Uint8Array | null {
  if (_keyBytes) return _keyBytes;
  const raw = process.env.QUOTE_SSO_SECRET;
  if (!raw) return null;
  _keyBytes = new TextEncoder().encode(raw);
  return _keyBytes;
}

/**
 * Mint a short-lived JWT for the quote app. Returns null if the secret isn't
 * configured or the caller doesn't have a usable email — the caller should
 * fall back to the plain URL (which drops the user at the email-entry form).
 */
export async function signQuoteAccessToken(input: {
  email: string | null | undefined;
  quoteId: string;
}): Promise<string | null> {
  const key = getKey();
  if (!key) return null;
  const email = input.email?.trim();
  if (!email) return null;

  return await new SignJWT({ quoteId: input.quoteId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + TTL_SECONDS)
    .sign(key);
}

/** Build the Web Quote URL, appending &sso=<jwt> when we can mint one. */
export async function buildWebQuoteUrl(input: {
  quoteId: string;
  email: string | null | undefined;
}): Promise<string> {
  const base = `https://airvues-quote.vercel.app/?quoteId=${input.quoteId}`;
  const token = await signQuoteAccessToken(input);
  return token ? `${base}&sso=${token}` : base;
}
