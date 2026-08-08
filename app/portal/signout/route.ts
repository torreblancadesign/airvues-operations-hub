import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_COOKIE } from "@/lib/portal-token";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/portal", req.url));
  // Clearing must use the same path the cookie was written with, or the
  // browser keeps the original and the visitor stays signed in.
  res.cookies.set(PORTAL_COOKIE, "", { path: "/portal", maxAge: 0 });
  return res;
}
