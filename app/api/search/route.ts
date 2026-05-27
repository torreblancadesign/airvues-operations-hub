// GET /api/search — returns the full search index for the signed-in user.
// Gated by getAppSession; no role-based filtering for v1.
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { getSearchIndex } from "@/lib/search-index";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.role) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const items = await getSearchIndex();
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
