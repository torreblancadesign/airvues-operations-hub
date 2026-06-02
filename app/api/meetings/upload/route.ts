// Vercel Blob upload handler for Meetings (audio-only recordings).
// Mirrors app/api/loops/upload. Audio MIME only, smaller cap (~100 MB).
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole, AuthzError } from "@/lib/authz";

const ALLOWED_MIME = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"];
const MEETING_UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100 MB (≈ 3+ hours of 64 kbps opus)

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
        const expectedPrefix = `meetings/${sessionId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: MEETING_UPLOAD_MAX_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ sessionId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op. The client calls createMeeting() after upload completes.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
