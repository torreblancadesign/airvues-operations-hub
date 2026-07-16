// Vercel Blob upload handler for Quote "Documents needed for Proposal" attachments.
// Mirrors app/api/leads/upload/route.ts but scoped to quotes/<quoteId>/ paths.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSignedIn, AuthzError } from "@/lib/authz";
import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from "@/lib/uploads";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireSignedIn();
  } catch (e) {
    if (e instanceof AuthzError) {
      return NextResponse.json({ error: e.reason }, { status: 403 });
    }
    throw e;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob not configured (missing BLOB_READ_WRITE_TOKEN)." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
        const payload = clientPayloadRaw ? JSON.parse(clientPayloadRaw) : {};
        const quoteId: unknown = payload.quoteId;
        if (typeof quoteId !== "string" || !quoteId.startsWith("rec")) {
          throw new Error("Invalid quoteId");
        }
        const expectedPrefix = `quotes/${quoteId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: [...UPLOAD_ALLOWED_MIME],
          maximumSizeInBytes: UPLOAD_MAX_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ quoteId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op. Client calls attachQuoteDocuments() after upload completes.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
