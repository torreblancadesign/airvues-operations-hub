// SAML sign-out — clears local session. (Single logout / SLO not implemented; just local.)
// GET /api/auth/saml/logout
import { NextRequest, NextResponse } from "next/server";
import { SAML_COOKIE_NAME } from "@/lib/samlSession";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL("/login", req.url);
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.delete(SAML_COOKIE_NAME);
  return res;
}

export async function POST(req: NextRequest) {
  return GET(req);
}
