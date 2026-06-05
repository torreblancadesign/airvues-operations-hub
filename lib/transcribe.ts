// Server-only AI helper. Calls Lovable AI Gateway (Gemini) to produce a
// transcript + 4 client-facing sections from a recorded Loop video.
//
// Pipeline:
//   1. Download the video from Blob storage.
//   2. Extract audio-only (mono 32kbps Opus) via bundled ffmpeg-static.
//      → ~5 MB for a 20-minute recording, well under the 20 MB inline cap.
//   3. Send the small audio payload to Gemini.
//   4. If ffmpeg extraction fails for any reason, fall back to inlining the
//      original video (legacy path, 20 MB cap, ~3-5 min recordings).
import "server-only";

import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

// Gemini inline-data ceiling. Applies to BOTH the audio path and the video
// fallback. 20 minutes of 32kbps mono Opus ≈ 5 MB so we have plenty of room.
const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20 MB
// We stream the video through ffmpeg without holding it in memory, so the
// source can be much larger than the inline cap.
const MAX_VIDEO_DOWNLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

export type LoopAnalysis = {
  transcript: string;
  summary: string;
  keyNotes: string;
  actionItems: string;
  questions: string;
};

export type LoopAnalysisResult = {
  analysis: LoopAnalysis;
  debug: string;
};

const EMPTY: LoopAnalysis = {
  transcript: "",
  summary: "",
  keyNotes: "",
  actionItems: "",
  questions: "",
};

const PROMPT = `You are summarizing an internal screen recording made for a client. You will be given the audio track from the recording (the visuals are not included — base everything on what is said).

Listen to the recording, then produce a transcript plus four short, client-facing sections in plain English (no jargon, no preamble, no markdown headings inside the values).

Return ONLY a JSON object with these exact keys (all strings):
- "transcript": the full spoken transcript, plain text, no timestamps, no speaker labels.
- "summary": 2-4 sentences describing what the recording covers.
- "keyNotes": the most important things the client needs to understand. Use short bullet-style lines separated by newlines, each starting with "- ".
- "actionItems": what the client needs to do next. Same bullet format. Empty string if there are none.
- "questions": questions that came up during the recording that the client needs to answer. Same bullet format. Empty string if there are none.

If a section genuinely has nothing to report, return an empty string for it. Do not fabricate.`;

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

type Payload = { data: Buffer; mime: string };

async function downloadVideo(
  videoUrl: string,
  log: string[],
): Promise<Payload | { error: string }> {
  let resp: Response;
  try {
    resp = await fetch(videoUrl);
  } catch (e) {
    return { error: `video fetch threw: ${(e as Error).message}` };
  }
  log.push(`video fetch: ${resp.status}`);
  if (!resp.ok) return { error: `video fetch failed ${resp.status}` };
  const len = Number(resp.headers.get("content-length") ?? "0");
  if (len && len > MAX_VIDEO_DOWNLOAD_BYTES) {
    return {
      error: `video too large: ${(len / 1024 / 1024).toFixed(1)}MB > 500MB cap`,
    };
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.byteLength > MAX_VIDEO_DOWNLOAD_BYTES) {
    return {
      error: `video too large after dl: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`,
    };
  }
  const mime = resp.headers.get("content-type")?.split(";")[0]?.trim() || "video/webm";
  log.push(`video: ${(buf.byteLength / 1024 / 1024).toFixed(2)}MB ${mime}`);
  return { data: buf, mime };
}

// Pipe the video buffer through ffmpeg and capture mono 32kbps Opus audio.
// Returns null if ffmpeg is unavailable or extraction failed for any reason —
// caller should fall back to the legacy video-inline path.
async function extractAudio(
  video: Buffer,
  log: string[],
): Promise<Payload | null> {
  if (!ffmpegPath) {
    log.push("ffmpeg: binary not found");
    return null;
  }
  return new Promise((resolve) => {
    const args = [
      "-i", "pipe:0",
      "-vn",                // drop video
      "-ac", "1",           // mono
      "-ar", "16000",       // 16kHz is plenty for speech
      "-b:a", "32k",
      "-c:a", "libopus",
      "-f", "webm",
      "pipe:1",
    ];
    let proc;
    try {
      proc = spawn(ffmpegPath as string, args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      log.push(`ffmpeg spawn threw: ${(e as Error).message}`);
      resolve(null);
      return;
    }
    const chunks: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    proc.on("error", (err) => {
      log.push(`ffmpeg error: ${err.message}`);
      resolve(null);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        log.push(`ffmpeg exit ${code}: ${stderr.slice(-200)}`);
        resolve(null);
        return;
      }
      const out = Buffer.concat(chunks);
      log.push(`audio: ${(out.byteLength / 1024 / 1024).toFixed(2)}MB`);
      if (out.byteLength === 0) {
        resolve(null);
        return;
      }
      if (out.byteLength > MAX_INLINE_BYTES) {
        log.push(`audio too large for inline: ${(out.byteLength / 1024 / 1024).toFixed(1)}MB`);
        resolve(null);
        return;
      }
      resolve({ data: out, mime: "audio/webm" });
    });
    proc.stdin.on("error", (err) => {
      log.push(`ffmpeg stdin error: ${err.message}`);
    });
    proc.stdin.end(video);
  });
}

export async function analyzeLoop(videoUrl: string): Promise<LoopAnalysisResult> {
  const started = Date.now();
  const log: string[] = [];
  const stamp = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  const done = (status: "OK" | "FAILED", extra?: string) => ({
    debug: `[${new Date().toISOString()}] ${status} | ${stamp()} | ${log.join(" | ")}${extra ? " | " + extra : ""}`.slice(0, 4000),
  });

  const key = process.env.LOVABLE_API_KEY;
  log.push(key ? `key: present (len=${key.length})` : "key: MISSING");
  if (!key) {
    return { analysis: EMPTY, ...done("FAILED", "LOVABLE_API_KEY not set in runtime env") };
  }

  const dl = await downloadVideo(videoUrl, log);
  if ("error" in dl) {
    return { analysis: EMPTY, ...done("FAILED", dl.error) };
  }

  // Try audio-only first. Fall back to inlining the video if extraction fails.
  let payload: Payload | null = await extractAudio(dl.data, log);
  let usedFallback = false;
  if (!payload) {
    usedFallback = true;
    log.push("falling back to video inline path");
    if (dl.data.byteLength > MAX_INLINE_BYTES) {
      return {
        analysis: EMPTY,
        ...done(
          "FAILED",
          `audio extraction failed and video is ${(dl.data.byteLength / 1024 / 1024).toFixed(1)}MB > 20MB inline cap`,
        ),
      };
    }
    payload = { data: dl.data, mime: dl.mime };
  }

  const dataUrl = `data:${payload.mime};base64,${payload.data.toString("base64")}`;
  const body = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };

  let resp: Response;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "raw",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { analysis: EMPTY, ...done("FAILED", `gateway fetch threw: ${(e as Error).message}`) };
  }

  log.push(`gateway: ${resp.status}${usedFallback ? " (video fallback)" : " (audio)"}`);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return {
      analysis: EMPTY,
      ...done("FAILED", `gateway ${resp.status}: ${text.slice(0, 400)}`),
    };
  }

  let json: { choices?: { message?: { content?: string } }[] };
  try {
    json = await resp.json();
  } catch (e) {
    return { analysis: EMPTY, ...done("FAILED", `gateway JSON parse: ${(e as Error).message}`) };
  }
  const content = json.choices?.[0]?.message?.content ?? "";
  log.push(`content len: ${content.length}`);
  const parsed = extractJson(content) as Partial<LoopAnalysis> | null;
  if (!parsed) {
    return {
      analysis: EMPTY,
      ...done("FAILED", `non-JSON content: ${content.slice(0, 300)}`),
    };
  }

  const analysis: LoopAnalysis = {
    transcript: safeString(parsed.transcript),
    summary: safeString(parsed.summary),
    keyNotes: safeString(parsed.keyNotes),
    actionItems: safeString(parsed.actionItems),
    questions: safeString(parsed.questions),
  };
  log.push(`transcript: ${analysis.transcript.length} chars`);
  return { analysis, ...done("OK") };
}
