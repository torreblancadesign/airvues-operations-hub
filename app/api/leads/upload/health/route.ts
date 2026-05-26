// Tiny diagnostic: confirms whether the production runtime sees BLOB_READ_WRITE_TOKEN.
// Safe to expose — returns only a boolean + token prefix, never the secret itself.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  return NextResponse.json({
    hasToken: token.length > 0,
    tokenLength: token.length,
    tokenPrefix: token.slice(0, 18), // e.g. "vercel_blob_rw_XXX"
    looksValid: /^vercel_blob_rw_/.test(token),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
