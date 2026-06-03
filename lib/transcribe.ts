// Server-only AI helper. Calls Lovable AI Gateway (Gemini) to produce a
// transcript + 4 client-facing sections from a recorded Loop video.
import "server-only";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap (gateway inline-data ceiling)

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

const PROMPT = `You are summarizing an internal screen recording made for a client.

Watch and listen to the recording, then produce a transcript plus four short, client-facing sections in plain English (no jargon, no preamble, no markdown headings inside the values).

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

  // Fetch video
  let mime = "video/webm";
  let b64 = "";
  try {
    const resp = await fetch(videoUrl);
    log.push(`video fetch: ${resp.status}`);
    if (!resp.ok) {
      return { analysis: EMPTY, ...done("FAILED", `video fetch failed ${resp.status}`) };
    }
    const len = Number(resp.headers.get("content-length") ?? "0");
    if (len && len > MAX_BYTES) {
      return {
        analysis: EMPTY,
        ...done("FAILED", `video too large: ${(len / 1024 / 1024).toFixed(1)}MB > 20MB cap`),
      };
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return {
        analysis: EMPTY,
        ...done("FAILED", `video too large after dl: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`),
      };
    }
    mime = resp.headers.get("content-type")?.split(";")[0]?.trim() || "video/webm";
    b64 = buf.toString("base64");
    log.push(`video: ${(buf.byteLength / 1024 / 1024).toFixed(2)}MB ${mime}`);
  } catch (e) {
    return { analysis: EMPTY, ...done("FAILED", `video fetch threw: ${(e as Error).message}`) };
  }

  const dataUrl = `data:${mime};base64,${b64}`;
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

  log.push(`gateway: ${resp.status}`);
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
