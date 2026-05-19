// SP metadata endpoint — returns the XML you upload/configure in Google Workspace SAML app setup.
// GET /api/auth/saml/metadata
import { NextResponse } from "next/server";
import { getSpMetadata, isSamlEnabled } from "@/lib/saml";

export const runtime = "nodejs";

export async function GET() {
  if (!isSamlEnabled()) {
    return new NextResponse("SAML not enabled (set AUTH_METHOD=saml)", { status: 404 });
  }
  try {
    const xml = getSpMetadata();
    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch (err) {
    return new NextResponse(`SP metadata error: ${(err as Error).message}`, { status: 500 });
  }
}
