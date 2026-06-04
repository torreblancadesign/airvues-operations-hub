// Server-only AI helper for meeting recordings (audio only).
// Calls Lovable AI Gateway (Gemini) to produce a transcript + 4 sections
// tuned for internal post-call note-taking (not client-facing copy).
import "server-only";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — Gemini inline-data ceiling

export type MeetingAnalysis = {
  transcript: string;
  summary: string;
  keyDecisions: string;
  actionItems: string;
  questions: string;
};

const EMPTY: MeetingAnalysis = {
  transcript: "",
  summary: "",
  keyDecisions: "",
  actionItems: "",
  questions: "",
};

type AnalyzeOpts = {
  channelLayout: "mic-left/tab-right" | "mono";
  recorderName: string | null;
  otherName: string | null;
};

function buildPrompt(opts: AnalyzeOpts): string {
  const me = opts.recorderName?.trim() || "Team";
  const them = opts.otherName?.trim() || "Client";

  const speakerRules =
    opts.channelLayout === "mic-left/tab-right"
      ? `The audio is STEREO and the channels are speaker-separated:
- The LEFT channel is ${me} (the Airvues team member recording the call — their microphone).
- The RIGHT channel is ${them} (the other participant(s) on the call — captured from the meeting tab).
Use the channel a voice is on to attribute every line. If a voice is louder on the left, it's ${me}. If a voice is louder on the right, it's ${them}. When both speak at once, label both lines. Never label a left-channel voice as ${them} or vice versa.`
      : `The audio is mono — channels cannot be used to attribute speakers. Identify ${me} (the Airvues team member) and ${them} (the other participant) by introductions and voice characteristics, and label accordingly.`;

  return `You are taking post-call notes for the internal Airvues team after a meeting they just had with a client or prospect.

${speakerRules}

Listen to the recording, then produce a full speaker-labeled transcript plus four short, plain-English internal-facing sections (no jargon, no preamble, no markdown headings inside the values).

Return ONLY a JSON object with these exact keys (all strings):
- "transcript": the full spoken transcript. Every line MUST start with the speaker's name followed by ": " — e.g. "${me}: ..." or "${them}: ...". No timestamps.
- "summary": 2-4 sentences describing what was discussed and where the conversation landed.
- "keyDecisions": decisions, commitments, or important things ${them} said. Short bullet-style lines separated by newlines, each starting with "- ". Empty string if none.
- "actionItems": what someone on the Airvues team needs to do next. Same bullet format. Include the owner in brackets when stated, e.g. "- [${me}] Send the updated quote by Friday". Empty string if none.
- "questions": open questions for ${them} that came up during the call and still need an answer. Same bullet format. Empty string if none.

Be specific and concrete. Do not fabricate details. If a section genuinely has nothing to report, return an empty string for it.`;
}

async function fetchAudioBase64(audioUrl: string): Promise<{ b64: string; mime: string } | null> {
  const resp = await fetch(audioUrl);
  if (!resp.ok) {
    console.warn(`[transcribe-meeting] fetch audio failed ${resp.status} ${audioUrl}`);
    return null;
  }
  const len = Number(resp.headers.get("content-length") ?? "0");
  if (len && len > MAX_BYTES) {
    console.warn(`[transcribe-meeting] audio too large (${len} bytes), skipping`);
    return null;
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    console.warn(`[transcribe-meeting] audio too large after download (${buf.byteLength} bytes)`);
    return null;
  }
  const mime = resp.headers.get("content-type")?.split(";")[0]?.trim() || "audio/webm";
  return { b64: buf.toString("base64"), mime };
}

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

export async function analyzeMeeting(
  audioUrl: string,
  opts: AnalyzeOpts = { channelLayout: "mono", recorderName: null, otherName: null },
): Promise<MeetingAnalysis> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    console.warn("[transcribe-meeting] LOVABLE_API_KEY missing");
    return EMPTY;
  }

  const audio = await fetchAudioBase64(audioUrl);
  if (!audio) return EMPTY;

  const dataUrl = `data:${audio.mime};base64,${audio.b64}`;

  const body = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildPrompt(opts) },
          // Gemini via OpenAI-compatible accepts audio as image_url data URI.
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
  const parsed = extractJson(content) as Partial<MeetingAnalysis> | null;
  if (!parsed) {
    throw new Error("AI gateway returned non-JSON content");
  }

  return {
    transcript: safeString(parsed.transcript),
    summary: safeString(parsed.summary),
    keyDecisions: safeString(parsed.keyDecisions),
    actionItems: safeString(parsed.actionItems),
    questions: safeString(parsed.questions),
  };
}
