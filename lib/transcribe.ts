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

async function fetchVideoBase64(videoUrl: string): Promise<{ b64: string; mime: string } | null> {
  const resp = await fetch(videoUrl);
  if (!resp.ok) {
    console.warn(`[transcribe] fetch video failed ${resp.status} ${videoUrl}`);
    return null;
  }
  const len = Number(resp.headers.get("content-length") ?? "0");
  if (len && len > MAX_BYTES) {
    console.warn(`[transcribe] video too large (${len} bytes), skipping analysis`);
    return null;
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    console.warn(`[transcribe] video too large after download (${buf.byteLength} bytes)`);
    return null;
  }
  const mime = resp.headers.get("content-type")?.split(";")[0]?.trim() || "video/webm";
  return { b64: buf.toString("base64"), mime };
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function extractJson(text: string): unknown {
  // Strip markdown fences if the model added them.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find the first {...} block.
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

export async function analyzeLoop(videoUrl: string): Promise<LoopAnalysis> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    console.warn("[transcribe] LOVABLE_API_KEY missing");
    return EMPTY;
  }

  const video = await fetchVideoBase64(videoUrl);
  if (!video) return EMPTY;

  const dataUrl = `data:${video.mime};base64,${video.b64}`;

  const body = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          // Gemini via OpenAI-compatible accepts media here as image_url; works for audio/video too.
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "raw",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content) as Partial<LoopAnalysis> | null;
  if (!parsed) {
    throw new Error("AI gateway returned non-JSON content");
  }

  return {
    transcript: safeString(parsed.transcript),
    summary: safeString(parsed.summary),
    keyNotes: safeString(parsed.keyNotes),
    actionItems: safeString(parsed.actionItems),
    questions: safeString(parsed.questions),
  };
}
