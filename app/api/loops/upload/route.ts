// Vercel Blob upload handler for Loops (screen recordings).
// Mirrors app/api/leads/upload + app/api/quotes/upload. Larger size cap.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole, AuthzError } from "@/lib/authz";
import { LOOP_UPLOAD_MAX_BYTES } from "@/lib/uploads";

const ALLOWED_MIME = [
  "video/webm",
  "video/mp4",
  "image/jpeg",
  "image/png",
];

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireRole("admin", "lead", "editor", "engineer");
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
        const sessionId: unknown = payload.sessionId;
        if (typeof sessionId !== "string" || !/^[a-z0-9]{8,40}$/.test(sessionId)) {
          throw new Error("Invalid sessionId");
        }
        const expectedPrefix = `loops/${sessionId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: LOOP_UPLOAD_MAX_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ sessionId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op. The client calls createLoop() after upload completes.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
