// GET /api/quote-sso?quoteId=xxx
// Signs an SSO token for the airvues-quote app and redirects. Gated by the
// airvues-ops session — only signed-in engineers/leads can mint these links.
// The token authenticates the "Prepared For" person on the quote so the
// visitor skips the email-entry step on the quote app.
import { NextResponse, type NextRequest } from "next/server";
import { getAppSession } from "@/lib/session";
import { listAllQuotes } from "@/lib/pipeline";
import { buildWebQuoteUrl } from "@/lib/quote-sso";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAppSession();
  if (!session?.user?.role) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const quoteId = req.nextUrl.searchParams.get("quoteId");
  if (!quoteId) {
    return NextResponse.json({ error: "missing quoteId" }, { status: 400 });
  }

  // Look up the quote to get the Prepared For primary email.
  const quotes = await listAllQuotes();
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = await buildWebQuoteUrl({ quoteId, email: quote.primaryEmail });
  return NextResponse.redirect(url, { status: 302 });
}
