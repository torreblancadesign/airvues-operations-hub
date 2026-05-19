// SP-initiated SSO. Builds the SAML AuthnRequest and redirects user to Google.
// GET /api/auth/saml/login
import { NextResponse } from "next/server";
import { buildLoginRedirect, isSamlEnabled } from "@/lib/saml";

export const runtime = "nodejs";

export async function GET() {
  if (!isSamlEnabled()) {
    return new NextResponse("SAML not enabled (set AUTH_METHOD=saml)", { status: 404 });
  }
  try {
    const redirectUrl = await buildLoginRedirect();
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    return new NextResponse(`SAML login error: ${(err as Error).message}`, { status: 500 });
  }
}
