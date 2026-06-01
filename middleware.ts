// Edge middleware — gates every protected route. Accepts either:
//   - SAML session cookie (set after Google Workspace SSO), OR
//   - NextAuth Google OAuth session cookie
// Both produce the same session shape downstream (see lib/session.ts).
//
// We only verify cookie *presence* + JWT signature here — full role checks happen in Server Components.
// jose is edge-runtime safe; samlify is not (Node-only).
//
// DEV_PREVIEW: in non-production with DEV_PREVIEW=true, skip the auth gate entirely.

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SAML_COOKIE_NAME } from "@/lib/samlSession";

const DEV_PREVIEW =
  process.env.NODE_ENV !== "production" && process.env.DEV_PREVIEW === "true";

// AUTH_BYPASS: kill switch for auth (works in production too). Set when SAML/OAuth
// are off and the app should be open. Skips the redirect-to-login gate entirely.
const AUTH_BYPASS = process.env.AUTH_BYPASS === "true";

const NEXTAUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

async function hasValidSamlCookie(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SAML_COOKIE_NAME)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "airvues-ops",
      audience: "airvues-ops",
    });
    return true;
  } catch {
    return false;
  }
}

function hasNextAuthCookie(req: NextRequest): boolean {
  for (const name of NEXTAUTH_COOKIE_NAMES) {
    if (req.cookies.get(name)) return true;
  }
  return false;
}

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;

  // Static assets at the root (e.g. /airvues-mark.png served from public/) must be public
  // so the login page can render before the user is authenticated.
  const isStaticAsset = /\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|css|js|map|txt|xml)$/i.test(
    nextUrl.pathname,
  );

  const isPublic =
    nextUrl.pathname === "/login" ||
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/r/") || // public Loops share pages
    nextUrl.pathname === "/favicon.ico" ||
    isStaticAsset;

  if (DEV_PREVIEW || AUTH_BYPASS) {
    return NextResponse.next();
  }

  const authed = (await hasValidSamlCookie(req)) || hasNextAuthCookie(req);

  if (!authed && !isPublic) {
    const url = nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (authed && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skip middleware entirely for Next.js internals + anything with a file extension
  // (i.e. static assets served from /public). Saves an edge function invocation per asset.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
