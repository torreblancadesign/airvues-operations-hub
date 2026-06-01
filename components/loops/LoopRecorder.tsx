"use client";

// Browser-native screen + mic recorder.
// Captures via getDisplayMedia + getUserMedia, encodes via MediaRecorder,
// uploads direct-to-Vercel-Blob (bypassing the 4.5 MB serverless body cap),
// then calls the createLoop server action to persist metadata.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { createLoop } from "@/lib/mutations/loop";
import { sanitizeUploadFilename } from "@/lib/uploads";
import type { LoopLinkKind } from "@/lib/loops-types";

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
  // 16 lowercase hex chars — matches the upload route's regex
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate a 1-frame poster JPEG from the recorded blob.
async function makePoster(videoBlob: Blob): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(videoBlob);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video load failed"));
    });
    // Seek a touch in so we don't get a black frame
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    });
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.drawImage(video, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
    );
  } catch {
    return null;
  }
}

type Props = {
  title: string;
  linkKind: LoopLinkKind;
  linkedId: string | null;
};

export function LoopRecorder({ title, linkKind, linkedId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startTsRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // Browser support gate
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
    streamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micStreamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting");
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // Browsers ignore unknown constraints, so this is safe.
          frameRate: { ideal: 30 },
        } as MediaTrackConstraints,
        audio: true,
      });
      streamRef.current = display;

      // Mic (optional — skip silently if denied)
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = mic;
      } catch {
        mic = null;
      }

      // Build a combined stream: display video + mixed audio (display + mic).
      const combinedTracks: MediaStreamTrack[] = [];
      combinedTracks.push(...display.getVideoTracks());

      const displayAudio = display.getAudioTracks();
      if (mic || displayAudio.length > 0) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        if (displayAudio.length > 0) {
          const src = ctx.createMediaStreamSource(
            new MediaStream(displayAudio),
          );
          src.connect(dest);
        }
        if (mic) {
          const src = ctx.createMediaStreamSource(mic);
          src.connect(dest);
        }
        combinedTracks.push(...dest.stream.getAudioTracks());
      }

      const combined = new MediaStream(combinedTracks);

      // Pick a supported mime type
      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        cleanupStreams();
        setStatus("stopped");
      };

      // If the user clicks "Stop sharing" in the browser bar, end the recording too.
      display.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state === "recording") recorder.stop();
      });

      recorder.start(1000);
      startTsRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startTsRef.current) / 1000);
      }, 250);
      setStatus("recording");
    } catch (e) {
      cleanupStreams();
      setStatus("error");
      setError((e as Error).message || "Failed to start recording");
    }
  }, [cleanupStreams]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const discard = useCallback(() => {
    blobRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStatus("idle");
    setElapsed(0);
    setUploadPct(0);
  }, [previewUrl]);

  const saveAndUpload = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setStatus("uploading");
    setError(null);
    try {
      const sessionId = newSessionId();
      const baseName = sanitizeUploadFilename(title || "recording").slice(0, 64) || "recording";

      // Upload video
      setUploadPct(5);
      const videoPath = `loops/${sessionId}/${baseName}.webm`;
      const videoBlob = await upload(videoPath, blob, {
        access: "public",
        handleUploadUrl: "/api/loops/upload",
        clientPayload: JSON.stringify({ sessionId }),
        contentType: blob.type || "video/webm",
        onUploadProgress: (p) => {
          // Reserve last 15% for the poster + Airtable write
          setUploadPct(Math.round(5 + p.percentage * 0.8));
        },
      });

      // Optional poster
      let posterUrl: string | null = null;
      try {
        const poster = await makePoster(blob);
        if (poster) {
          setUploadPct(88);
          const posterRes = await upload(
            `loops/${sessionId}/${baseName}.jpg`,
            poster,
            {
              access: "public",
              handleUploadUrl: "/api/loops/upload",
              clientPayload: JSON.stringify({ sessionId }),
              contentType: "image/jpeg",
            },
          );
          posterUrl = posterRes.url;
        }
      } catch {
        // ignore — poster is best-effort
      }

      setUploadPct(94);
      setStatus("saving");
      const res = await createLoop({
        title,
        videoUrl: videoBlob.url,
        posterUrl,
        durationSec: elapsed,
        sizeMb: blob.size / (1024 * 1024),
        linkKind,
        linkedId,
      });
      if ("error" in res) throw new Error(res.error);
      setUploadPct(100);
      setStatus("done");
      router.push(`/loops/${res.id}`);
      router.refresh();
    } catch (e) {
      setStatus("error");
      setError((e as Error).message || "Upload failed");
    }
  }, [title, elapsed, linkKind, linkedId, router]);

  useEffect(() => () => cleanupStreams(), [cleanupStreams]);

  if (supported === false) {
    return (
      <div className="bg-surface border border-red/30 rounded-card p-5 text-[13px] text-red">
        Screen recording isn&apos;t supported in this browser. Use desktop
        Chrome, Edge, or Firefox.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-rule rounded-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="font-mono text-[12px] uppercase tracking-wider text-ink-faint">
          {status === "recording" ? (
            <span className="text-red flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red animate-pulse" />
              Recording · {fmtTime(elapsed)}
            </span>
          ) : status === "uploading" ? (
            `Uploading · ${uploadPct}%`
          ) : status === "saving" ? (
            "Saving…"
          ) : status === "stopped" ? (
            `Captured · ${fmtTime(elapsed)}`
          ) : status === "requesting" ? (
            "Waiting for browser…"
          ) : (
            "Ready"
          )}
        </div>
        <div className="flex gap-2">
          {status === "idle" && (
            <button
              onClick={start}
              className="px-4 py-2 rounded-md bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/20 text-[13px] font-medium transition"
            >
              Start recording
            </button>
          )}
          {status === "recording" && (
            <button
              onClick={stop}
              className="px-4 py-2 rounded-md bg-red/15 border border-red/30 text-red hover:bg-red/20 text-[13px] font-medium transition"
            >
              Stop
            </button>
          )}
          {status === "stopped" && (
            <>
              <button
                onClick={discard}
                className="px-4 py-2 rounded-md border border-rule text-ink-muted hover:text-ink-strong hover:bg-surface/60 text-[13px] transition"
              >
                Discard
              </button>
              <button
                onClick={saveAndUpload}
                className="px-4 py-2 rounded-md bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/20 text-[13px] font-medium transition"
              >
                Save &amp; upload
              </button>
            </>
          )}
        </div>
      </div>

      {status === "uploading" && (
        <div className="h-1 w-full bg-surface/60 rounded overflow-hidden">
          <div
            className="h-full bg-emerald transition-all"
            style={{ width: `${uploadPct}%` }}
          />
        </div>
      )}

      {previewUrl && (
        <video
          src={previewUrl}
          controls
          className="w-full rounded-md border border-rule bg-black aspect-video"
        />
      )}

      {error && (
        <div className="text-[12px] text-red bg-red/10 border border-red/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <p className="text-[11px] text-ink-faint leading-snug font-mono">
        Tip: pick &quot;Entire screen&quot; in the browser picker to capture your
        whole desktop. System audio is captured on Chrome/Edge when you tick
        &quot;Share system audio.&quot; Safari can&apos;t capture system audio
        (mic still works).
      </p>
    </div>
  );
}
