"use client";

// Audio-only meeting recorder.
// - Captures tab audio via getDisplayMedia({ audio:true, video:true })
//   then immediately stops the video track (we only keep audio).
// - Captures mic via getUserMedia({ audio:true }).
// - Mixes both into a single audio stream via Web Audio.
// - Encodes opus webm via MediaRecorder.
// - Uploads to Vercel Blob, then calls createMeeting() server action.

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { createMeeting } from "@/lib/mutations/meeting";
import type { MeetingSource } from "@/lib/meetings-types";

type Status =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "uploading"
  | "saving"
  | "done"
  | "error";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function newSessionId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Props = {
  leadId: string | null;
  leadName: string | null;
  defaultTitle: string;
  source: MeetingSource;
};

export function MeetingRecorder({ leadId, leadName, defaultTitle, source }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [title, setTitle] = useState(defaultTitle);
  const [meetingId, setMeetingId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const displayRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTsRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
        typeof window.MediaRecorder === "function",
    );
  }, []);

  // Beforeunload guard while recording
  useEffect(() => {
    if (status !== "recording") return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [status]);

  const cleanupStreams = useCallback(() => {
    displayRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current?.getTracks().forEach((t) => t.stop());
    displayRef.current = null;
    micRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (levelRafRef.current !== null) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanupStreams(), [cleanupStreams]);

  const start = useCallback(async () => {
    setError(null);
    setWarning(null);
    setStatus("requesting");
    try {
      // Request screen-share. Audio capture only works when the user picks a
      // BROWSER TAB source AND ticks "Share tab audio".
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      displayRef.current = display;

      const videoTracks = display.getVideoTracks();
      const audioTracks = display.getAudioTracks();
      const settings = videoTracks[0]?.getSettings() as
        | (MediaTrackSettings & { displaySurface?: string })
        | undefined;
      const surface = settings?.displaySurface;

      if (audioTracks.length === 0) {
        // No tab audio — user picked a window/screen or unchecked the box.
        display.getTracks().forEach((t) => t.stop());
        displayRef.current = null;
        const hint =
          surface === "monitor" || surface === "window"
            ? "Pick a browser TAB (not a window or screen) so audio is available, then tick \"Share tab audio\"."
            : "Tick the \"Share tab audio\" box in Chrome's share dialog and try again.";
        throw new Error(`This recording would have no audio. ${hint}`);
      }

      // Stop the video track immediately — we only keep audio.
      videoTracks.forEach((t) => t.stop());

      // Mic (optional but recommended).
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micRef.current = mic;
      } catch {
        mic = null;
        setWarning("Mic access was denied — recording the meeting audio only.");
      }

      // Build a stereo graph so the AI can tell who's talking:
      //   LEFT  channel = your mic (the recorder)
      //   RIGHT channel = tab audio (the other participants)
      // If the mic was denied, fall back to mono tab audio.
      const ctx = new AudioContext({ latencyHint: "interactive" });
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      const tabSrc = ctx.createMediaStreamSource(new MediaStream(audioTracks));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;

      if (mic) {
        const micSrc = ctx.createMediaStreamSource(mic);
        const merger = ctx.createChannelMerger(2);
        // Force each source down to a single channel before merging so the
        // resulting MediaStream is true stereo (mic = L, tab = R).
        const micMono = ctx.createGain();
        micMono.channelCount = 1;
        micMono.channelCountMode = "explicit";
        micMono.channelInterpretation = "speakers";
        const tabMono = ctx.createGain();
        tabMono.channelCount = 1;
        tabMono.channelCountMode = "explicit";
        tabMono.channelInterpretation = "speakers";
        micSrc.connect(micMono);
        tabSrc.connect(tabMono);
        micMono.connect(merger, 0, 0); // → left
        tabMono.connect(merger, 0, 1); // → right
        merger.connect(dest);
        // Tap both into the level meter so it reflects either speaker.
        micMono.connect(analyser);
        tabMono.connect(analyser);
      } else {
        // Mono fallback — tab audio only.
        tabSrc.connect(dest);
        tabSrc.connect(analyser);
      }

      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tickLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setLevel(peak);
        levelRafRef.current = requestAnimationFrame(tickLevel);
      };
      levelRafRef.current = requestAnimationFrame(tickLevel);

      // If display track ends (user clicks "Stop sharing"), stop the recording.
      audioTracks[0].addEventListener("ended", () => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          recorderRef.current.stop();
        }
      });

      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mimeType =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "audio/webm";

      const recorder = new MediaRecorder(dest.stream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        setStatus("stopped");
      };

      recorder.start(1000);
      startTsRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000));
      }, 250);
      setStatus("recording");
    } catch (e) {
      cleanupStreams();
      setStatus("error");
      setError((e as Error).message || "Couldn't start recording.");
    }
  }, [cleanupStreams]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    cleanupStreams();
  }, [cleanupStreams]);

  const save = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) {
      setError("No recording to save.");
      return;
    }
    setStatus("uploading");
    setError(null);
    try {
      const sessionId = newSessionId();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const pathname = `meetings/${sessionId}/audio.${ext}`;
      // Strip codec params (e.g. "audio/webm;codecs=opus") — Vercel Blob
      // allowedContentTypes only matches the base MIME.
      const baseMime = (blob.type || `audio/${ext}`).split(";")[0].trim();
      const uploaded = await upload(pathname, blob, {
        access: "public",
        handleUploadUrl: "/api/meetings/upload",
        clientPayload: JSON.stringify({ sessionId }),
        contentType: baseMime,
        onUploadProgress: (p: { percentage: number }) => setUploadPct(p.percentage),
      });
      setStatus("saving");
      const res = await createMeeting({
        title: title.trim() || defaultTitle,
        audioUrl: uploaded.url,
        durationSec: elapsed,
        sizeMb: blob.size / (1024 * 1024),
        source,
        linkedLeadId: leadId,
      });
      if ("error" in res) {
        setStatus("error");
        setError(res.error);
        return;
      }
      setMeetingId(res.id);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError((e as Error).message || "Upload failed.");
    }
  }, [title, defaultTitle, elapsed, source, leadId]);

  const discard = useCallback(() => {
    blobRef.current = null;
    setStatus("idle");
    setElapsed(0);
    setUploadPct(0);
    setError(null);
    setWarning(null);
    chunksRef.current = [];
  }, []);

  if (supported === false) {
    return (
      <div className="bg-surface border border-red/30 rounded-card p-4 text-[13px] text-red">
        Your browser can't capture tab audio. Use the latest Chrome or Edge.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {leadName ? (
        <div className="text-[12px] font-mono uppercase tracking-wider text-ink-faint">
          Recording for{" "}
          <span className="text-emerald normal-case tracking-normal font-sans">{leadName}</span>
        </div>
      ) : (
        <div className="text-[12px] font-mono uppercase tracking-wider text-ink-faint">
          Manual recording · no lead linked
        </div>
      )}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Meeting title"
        disabled={status === "recording" || status === "uploading" || status === "saving"}
        className="w-full bg-bg-elevated border border-rule rounded px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-emerald disabled:opacity-60"
      />

      {status === "idle" && (
        <div className="space-y-3">
          <button
            onClick={start}
            className="w-full px-4 py-3 rounded-md bg-emerald text-bg font-medium text-[14px] hover:bg-emerald/85 transition"
          >
            ● Start recording
          </button>
          <p className="text-[11.5px] text-ink-muted leading-relaxed">
            Chrome will ask what to share. Pick the <strong>browser tab</strong> running your
            meeting and tick <strong>"Share tab audio"</strong>. Your mic is captured
            separately and mixed in.
          </p>
        </div>
      )}

      {status === "requesting" && (
        <div className="text-[13px] text-ink-muted">Waiting for screen-share permission…</div>
      )}

      {status === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red animate-pulse" />
            <span className="text-[20px] font-mono tabnum text-ink-strong">
              {fmtTime(elapsed)}
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-red ml-auto">
              Recording
            </span>
          </div>
          <div className="h-2 bg-bg-elevated rounded overflow-hidden">
            <div
              className="h-full bg-emerald transition-[width] duration-75"
              style={{ width: `${Math.min(100, level * 220)}%` }}
            />
          </div>
          <button
            onClick={stop}
            className="w-full px-4 py-3 rounded-md bg-red/20 border border-red/40 text-red font-medium text-[14px] hover:bg-red/30 transition"
          >
            ■ Stop & review
          </button>
        </div>
      )}

      {status === "stopped" && (
        <div className="space-y-3">
          <div className="text-[13px] text-ink-strong">
            Recorded {fmtTime(elapsed)} ·{" "}
            {blobRef.current ? `${(blobRef.current.size / (1024 * 1024)).toFixed(1)} MB` : ""}
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex-1 px-4 py-3 rounded-md bg-emerald text-bg font-medium text-[14px] hover:bg-emerald/85 transition"
            >
              Save & transcribe
            </button>
            <button
              onClick={discard}
              className="px-3 py-3 rounded-md bg-bg-elevated border border-rule text-ink text-[13px] hover:border-ink-muted transition"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {(status === "uploading" || status === "saving") && (
        <div className="space-y-2">
          <div className="text-[13px] text-ink-muted">
            {status === "uploading" ? `Uploading audio… ${Math.round(uploadPct)}%` : "Saving…"}
          </div>
          <div className="h-2 bg-bg-elevated rounded overflow-hidden">
            <div
              className="h-full bg-emerald transition-[width] duration-200"
              style={{ width: `${status === "saving" ? 100 : uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {status === "done" && meetingId && (
        <div className="space-y-3">
          <div className="text-[13px] text-emerald">
            ✓ Saved. AI notes are generating in the background.
          </div>
          <div className="flex gap-2">
            <a
              href={`/meetings/${meetingId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center px-4 py-2 rounded-md bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/20 text-[13px] font-medium transition"
            >
              Open meeting →
            </a>
            <button
              onClick={() => window.close()}
              className="px-3 py-2 rounded-md bg-bg-elevated border border-rule text-ink text-[13px] hover:border-ink-muted transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {warning && (
        <div className="text-[12px] text-amber-300 bg-amber-300/5 border border-amber-300/20 rounded px-2.5 py-1.5">
          {warning}
        </div>
      )}
      {error && (
        <div className="text-[12px] text-red bg-red/5 border border-red/30 rounded px-2.5 py-1.5">
          {error}
        </div>
      )}
    </div>
  );
}
