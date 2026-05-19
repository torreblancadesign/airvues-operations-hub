// ACS endpoint — Google posts the SAMLResponse here after successful auth.
// POST /api/auth/saml/sso  (form-encoded: SAMLResponse=...&RelayState=...)
import { NextRequest, NextResponse } from "next/server";
import { isSamlEnabled, processAcsResponse } from "@/lib/saml";
import { samlCookieOptions, signSamlSession } from "@/lib/samlSession";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSamlEnabled()) {
    return new NextResponse("SAML not enabled", { status: 404 });
  }
  try {
    const form = await req.formData();
    const params = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") params.append(key, value);
    }

    const { email, name, role } = await processAcsResponse(params);
    const token = await signSamlSession({ email, name, role });

    // Redirect to home; user is now signed in via SAML cookie
    const url = new URL("/", req.url);
    const res = NextResponse.redirect(url, { status: 303 });
    res.cookies.set(samlCookieOptions.name, token, {
      httpOnly: samlCookieOptions.httpOnly,
      sameSite: samlCookieOptions.sameSite,
      secure: samlCookieOptions.secure,
      path: samlCookieOptions.path,
      maxAge: samlCookieOptions.maxAge,
    });
    return res;
  } catch (err) {
    const msg = (err as Error).message;
    // Redirect to a friendly error page so the user sees what went wrong
    const url = new URL("/login", req.url);
    url.searchParams.set("error", encodeURIComponent(msg.slice(0, 200)));
    return NextResponse.redirect(url, { status: 303 });
  }
}

// Some IdPs use GET with query params. Google uses POST but support both for safety.
export async function GET(req: NextRequest) {
  return POST(req);
}
