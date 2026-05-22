// Vercel Blob upload handler for Lead supporting documents.
// Client uses @vercel/blob/client `upload()` which calls this route to mint a token,
// then PUTs the bytes directly to Blob storage (bypassing Vercel's 4.5 MB body limit).
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole, AuthzError } from "@/lib/authz";
import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from "@/lib/uploads";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireRole("admin", "lead", "editor");
  } catch (e) {
    if (e instanceof AuthzError) {
      return NextResponse.json({ error: e.reason }, { status: 403 });
    }
    throw e;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob not configured (missing BLOB_READ_WRITE_TOKEN). Create a Blob store in Vercel → Storage." },
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
        const leadId: unknown = payload.leadId;
        if (typeof leadId !== "string" || !leadId.startsWith("rec")) {
          throw new Error("Invalid leadId");
        }
        const expectedPrefix = `leads/${leadId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: [...UPLOAD_ALLOWED_MIME],
          maximumSizeInBytes: UPLOAD_MAX_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ leadId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op. The client calls attachLeadFiles() after upload to persist into Airtable.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
