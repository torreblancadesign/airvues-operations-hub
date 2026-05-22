// Vercel Blob upload handler for Lead supporting documents.
// Client uses @vercel/blob/client `upload()` which calls this route to mint a token,
// then PUTs the bytes directly to Blob storage (bypassing Vercel's 4.5 MB body limit).
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole, AuthzError } from "@/lib/authz";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "video/quicktime",
];

function sanitize(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 200);
}

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
        // pathname comes from the client. Enforce our own scheme.
        const expectedPrefix = `leads/${leadId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ leadId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op. The client calls attachLeadFiles() after upload to persist into Airtable,
        // so we get the rehydrated attachment record back synchronously.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// Helper export for the client to build a sanitized pathname.
export const sanitizeUploadFilename = sanitize;
