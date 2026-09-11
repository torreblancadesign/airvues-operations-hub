// Redeem a magic link: ?t=<jwt> → portal session cookie → /portal
//
// The token proves the link was minted by this app and has not expired. It
// does NOT prove the person is still allowed in, so access is re-checked
// against Airtable here before any cookie is set.
import { NextResponse, type NextRequest } from "next/server";
import { getRecord } from "@/lib/airtable";
import { Tables } from "@/lib/schema";
import {
  PORTAL_COOKIE,
  SESSION_TTL_SECONDS,
  signPortalSession,
  verifyPortalLinkToken,
} from "@/lib/portal-token";
import { touchPortalLogin } from "@/lib/portal-session";

export const dynamic = "force-dynamic";

function deny(req: NextRequest, reason: string) {
  const url = new URL("/portal", req.url);
  url.searchParams.set("denied", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) return deny(req, "missing");

  const claims = await verifyPortalLinkToken(token);
  if (!claims) return deny(req, "expired");

  // Re-check against the live record. A link minted before access was revoked
  // must not still work, and the 30-minute TTL is not a substitute for asking.
  let rec;
  try {
    rec = await getRecord<Record<string, unknown>>(Tables.People.id, claims.personId);
  } catch {
    return deny(req, "unknown");
  }
  if (rec.fields["Portal Access"] !== true) return deny(req, "revoked");

  const company = rec.fields["Company"];
  const companyId =
    Array.isArray(company) && typeof company[0] === "string" ? company[0] : null;
  if (!companyId) return deny(req, "noclient");

  const session = await signPortalSession({
    personId: claims.personId,
    companyId,
    email: claims.email,
  });
  if (!session) return deny(req, "unconfigured");

  await touchPortalLogin(claims.personId);

  const res = NextResponse.redirect(new URL("/portal", req.url));
  res.cookies.set(PORTAL_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
