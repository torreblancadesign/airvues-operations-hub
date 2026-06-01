"use client";

// Browser-native screen + mic recorder with optional Airvues face-bubble overlay.
// Captures via getDisplayMedia + getUserMedia, optionally composites a webcam
// "presence bubble" via a canvas pipeline so the face is BURNED INTO the file,
// encodes via MediaRecorder, uploads direct-to-Vercel-Blob, then persists
// metadata via the createLoop server action.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { createLoop } from "@/lib/mutations/loop";
import { sanitizeUploadFilename } from "@/lib/uploads";

type Status =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "uploading"
  | "saving"
  | "done"
  | "error";

type Corner = "br" | "bl" | "tr" | "tl";

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

// Squircle-ish rounded rect clip path for the bubble.
function squirclePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const r = size * 0.32;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
  linkedClientId: string | null;
  linkedQuoteId: string | null;
  ownerFirstName: string | null;
};

const CORNER_LABEL: Record<Corner, string> = {
  br: "BR",
  bl: "BL",
  tr: "TR",
  tl: "TL",
};

export function LoopRecorder({
  title,
  linkedClientId,
  linkedQuoteId,
  ownerFirstName,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Face-bubble controls
  const [faceOn, setFaceOn] = useState(false);
  const [corner, setCorner] = useState<Corner>("br");
  const [camPreviewStream, setCamPreviewStream] = useState<MediaStream | null>(
    null,
  );
  const camPreviewStreamRef = useRef<MediaStream | null>(null);
  const camPreviewRef = useRef<HTMLVideoElement | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startTsRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const rafRef = useRef<number | null>(null);
  const rvfcRef = useRef<number | null>(null);
  const stopDrawRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayVideoRef = useRef<HTMLVideoElement | null>(null);
  const camVideoRef = useRef<HTMLVideoElement | null>(null);

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

  // Attach the camera preview stream to its <video> element whenever the
  // user toggles the face bubble on OR transitions between recording states.
  useEffect(() => {
    camPreviewStreamRef.current = camPreviewStream;
    if (camPreviewRef.current && camPreviewStream) {
      camPreviewRef.current.srcObject = camPreviewStream;
      camPreviewRef.current.play?.().catch(() => {});
    }
  }, [camPreviewStream, faceOn, status]);

  const stopCamPreview = useCallback(() => {
    camPreviewStreamRef.current?.getTracks().forEach((t) => t.stop());
    camPreviewStreamRef.current = null;
    setCamPreviewStream(null);
  }, []);

  const enableFace = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        // Small capture — bubble renders at <=240px so 320 is plenty
        video: {
          width: { ideal: 320 },
          height: { ideal: 320 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      setCamPreviewStream(s);
      setFaceOn(true);
    } catch {
      setError("Camera access denied — face bubble disabled.");
      setFaceOn(false);
    }
  }, []);

  const disableFace = useCallback(() => {
    setFaceOn(false);
    stopCamPreview();
  }, [stopCamPreview]);

  const cleanupStreams = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micStreamRef.current = null;
    // NOTE: we deliberately keep camPreviewStream alive so the user can
    // re-record without re-granting camera permission. stopCamPreview()
    // is called explicitly on toggle-off or unmount.
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopDrawRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    rvfcRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting");
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } } as MediaTrackConstraints,
        audio: true,
      });
      streamRef.current = display;

      // Mic (optional)
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = mic;
      } catch {
        mic = null;
      }

      // Webcam: REUSE the already-live preview stream (single source of truth).
      // If face is on but for some reason the preview stream died, re-request.
      let cam: MediaStream | null = null;
      if (faceOn) {
        if (
          camPreviewStream &&
          camPreviewStream.getVideoTracks()[0]?.readyState === "live"
        ) {
          cam = camPreviewStream;
        } else {
          try {
            cam = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 320 },
                height: { ideal: 320 },
                frameRate: { ideal: 30 },
              },
              audio: false,
            });
            setCamPreviewStream(cam);
          } catch {
            cam = null;
          }
        }
      }

      // ── Build the video source for the recorder ─────────────────────────
      const displaySettings = display.getVideoTracks()[0]?.getSettings();
      const dispW = displaySettings?.width ?? 1920;
      const dispH = displaySettings?.height ?? 1080;

      let videoTrackForRecorder: MediaStreamTrack;

      if (cam) {
        // Cap canvas to 1080p max, preserving aspect ratio. Drawing &
        // encoding 4K every frame is what made the bubble feel choppy.
        const MAX_W = 1920;
        const MAX_H = 1080;
        const scaleDown = Math.min(1, MAX_W / dispW, MAX_H / dispH);
        const canvasW = Math.round(dispW * scaleDown);
        const canvasH = Math.round(dispH * scaleDown);

        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        canvasRef.current = canvas;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas 2D context unavailable");

        const dispVid = document.createElement("video");
        dispVid.srcObject = display;
        dispVid.muted = true;
        dispVid.playsInline = true;
        await dispVid.play();
        displayVideoRef.current = dispVid;

        const camVid = document.createElement("video");
        camVid.srcObject = cam;
        camVid.muted = true;
        camVid.playsInline = true;
        await camVid.play();
        camVideoRef.current = camVid;

        const drawStart = performance.now();
        const bubbleSize = Math.min(
          Math.floor(Math.min(canvasW, canvasH) * 0.18),
          240,
        );
        const sideMargin = Math.floor(bubbleSize * 0.22);
        // Bottom margin must clear the browser's "Stop sharing" bar
        // (Chrome/Edge overlay it bottom-center, ~80px tall).
        const bottomMargin = Math.max(sideMargin, 110);
        const captionText = (ownerFirstName ?? "").toUpperCase().slice(0, 12);
        const cornerForFrame = corner;

        stopDrawRef.current = false;

        const drawFrame = () => {
          if (stopDrawRef.current) return;

          // Background = full screen (downscaled into canvas)
          try {
            ctx.drawImage(dispVid, 0, 0, canvasW, canvasH);
          } catch {
            /* video not ready */
          }

          // Fade-in alpha over first 400ms
          const t = (performance.now() - drawStart) / 400;
          const alpha = Math.min(1, Math.max(0, t));

          // Bubble corner
          let bx = canvasW - bubbleSize - sideMargin;
          let by = canvasH - bubbleSize - bottomMargin;
          if (cornerForFrame === "bl") {
            bx = sideMargin;
            by = canvasH - bubbleSize - bottomMargin;
          }
          if (cornerForFrame === "tr") {
            bx = canvasW - bubbleSize - sideMargin;
            by = sideMargin;
          }
          if (cornerForFrame === "tl") {
            bx = sideMargin;
            by = sideMargin;
          }

          ctx.save();
          ctx.globalAlpha = alpha;

          // Outer emerald glow + dark backplate
          ctx.shadowColor = "rgba(34, 211, 168, 0.35)";
          ctx.shadowBlur = 18;
          ctx.fillStyle = "rgba(11, 15, 23, 0.6)";
          squirclePath(ctx, bx, by, bubbleSize);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Clip to squircle and draw webcam (cover-fit, mirrored)
          ctx.save();
          squirclePath(ctx, bx, by, bubbleSize);
          ctx.clip();
          const cw = camVid.videoWidth || 1;
          const ch = camVid.videoHeight || 1;
          const scale = Math.max(bubbleSize / cw, bubbleSize / ch);
          const dw = cw * scale;
          const dh = ch * scale;
          const dx = bx + (bubbleSize - dw) / 2;
          const dy = by + (bubbleSize - dh) / 2;
          ctx.translate(dx + dw, dy);
          ctx.scale(-1, 1);
          try {
            ctx.drawImage(camVid, 0, 0, dw, dh);
          } catch {
            /* not ready */
          }
          ctx.restore();

          // Emerald ring
          ctx.lineWidth = Math.max(2, bubbleSize * 0.018);
          ctx.strokeStyle = "rgba(34, 211, 168, 0.75)";
          squirclePath(ctx, bx, by, bubbleSize);
          ctx.stroke();

          // Caption (first name) beneath the bubble
          if (captionText) {
            const fontSize = Math.max(11, Math.floor(bubbleSize * 0.085));
            ctx.font = `600 ${fontSize}px ui-monospace, "JetBrains Mono", monospace`;
            ctx.fillStyle = "rgba(232, 236, 242, 0.85)";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const captionY =
              cornerForFrame === "tl" || cornerForFrame === "tr"
                ? by + bubbleSize + fontSize * 0.4
                : by + bubbleSize + fontSize * 0.4;
            const spaced = captionText.split("").join(" ");
            ctx.fillText(spaced, bx + bubbleSize / 2, captionY);
          }

          ctx.restore();
        };

        // Prefer requestVideoFrameCallback (Chrome/Edge/Safari) — fires once
        // per real source frame, eliminating duplicated/dropped frames the
        // rAF-driven loop produced. Fall back to rAF on Firefox.
        const hasRVFC =
          typeof (dispVid as unknown as { requestVideoFrameCallback?: unknown })
            .requestVideoFrameCallback === "function";

        if (hasRVFC) {
          const tick = () => {
            if (stopDrawRef.current) return;
            drawFrame();
            rvfcRef.current = (
              dispVid as unknown as {
                requestVideoFrameCallback: (cb: () => void) => number;
              }
            ).requestVideoFrameCallback(tick);
          };
          rvfcRef.current = (
            dispVid as unknown as {
              requestVideoFrameCallback: (cb: () => void) => number;
            }
          ).requestVideoFrameCallback(tick);
        } else {
          const tick = () => {
            if (stopDrawRef.current) return;
            drawFrame();
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }

        const canvasStream = canvas.captureStream(24);
        videoTrackForRecorder = canvasStream.getVideoTracks()[0];
      } else {
        videoTrackForRecorder = display.getVideoTracks()[0];
      }

      // ── Audio mix (display audio + mic) ─────────────────────────────────
      const combinedTracks: MediaStreamTrack[] = [videoTrackForRecorder];

      const displayAudio = display.getAudioTracks();
      if (mic || displayAudio.length > 0) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        if (displayAudio.length > 0) {
          const src = ctx.createMediaStreamSource(new MediaStream(displayAudio));
          src.connect(dest);
        }
        if (mic) {
          const src = ctx.createMediaStreamSource(mic);
          src.connect(dest);
        }
        combinedTracks.push(...dest.stream.getAudioTracks());
      }

      const combined = new MediaStream(combinedTracks);

      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: cam ? 3_000_000 : 2_500_000,
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
  }, [cleanupStreams, faceOn, camPreviewStream, corner, ownerFirstName]);

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
      const baseName =
        sanitizeUploadFilename(title || "recording").slice(0, 64) || "recording";

      setUploadPct(5);
      const videoPath = `loops/${sessionId}/${baseName}.webm`;
      const videoBlob = await upload(videoPath, blob, {
        access: "public",
        handleUploadUrl: "/api/loops/upload",
        clientPayload: JSON.stringify({ sessionId }),
        contentType: (blob.type || "video/webm").split(";")[0].trim(),
        onUploadProgress: (p) => {
          setUploadPct(Math.round(5 + p.percentage * 0.8));
        },
      });

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
        /* poster best-effort */
      }

      setUploadPct(94);
      setStatus("saving");
      const res = await createLoop({
        title,
        videoUrl: videoBlob.url,
        posterUrl,
        durationSec: elapsed,
        sizeMb: blob.size / (1024 * 1024),
        linkedClientId,
        linkedQuoteId,
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
  }, [title, elapsed, linkedClientId, linkedQuoteId, router]);

  useEffect(() => () => cleanupStreams(), [cleanupStreams]);
  // Unmount-only: stop the live camera preview when the component goes away.
  // Do NOT depend on stopCamPreview here — its identity churn used to fire this
  // cleanup mid-session and kill the webcam track.
  useEffect(() => {
    return () => {
      camPreviewStreamRef.current?.getTracks().forEach((t) => t.stop());
      camPreviewStreamRef.current = null;
    };
  }, []);

  if (supported === false) {
    return (
      <div className="bg-surface border border-red/30 rounded-card p-5 text-[13px] text-red">
        Screen recording isn&apos;t supported in this browser. Use desktop
        Chrome, Edge, or Firefox.
      </div>
    );
  }

  const canConfigure = status === "idle";
  const showPresenceChip =
    faceOn && (status === "idle" || status === "recording" || status === "requesting");

  return (
    <div className="bg-surface border border-rule rounded-card p-5 space-y-4 relative">
      {/* Face bubble controls */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-rule/60">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={faceOn ? disableFace : enableFace}
            disabled={!canConfigure}
            className={`relative inline-flex items-center h-6 w-11 rounded-full transition border ${
              faceOn
                ? "bg-emerald/25 border-emerald/50"
                : "bg-surface/60 border-rule"
            } ${!canConfigure ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-pressed={faceOn}
          >
            <span
              className={`inline-block w-4 h-4 rounded-full bg-ink-strong shadow transition-transform ${
                faceOn ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <div>
            <div className="text-[12px] font-semibold text-ink-strong leading-none">
              Show my face
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
              Burned into the recording
            </div>
          </div>
        </div>

        {faceOn && (
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
              Corner
            </label>
            <select
              value={corner}
              onChange={(e) => setCorner(e.target.value as Corner)}
              disabled={!canConfigure}
              className="bg-surface/40 border border-rule rounded-md px-2 py-1 text-[12px] text-ink-strong"
            >
              <option value="br">Bottom right (above share bar)</option>
              <option value="bl">Bottom left (above share bar)</option>
              <option value="tr">Top right</option>
              <option value="tl">Top left</option>
            </select>
          </div>
        )}
      </div>

      {/* Recorder header */}
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

      {/* Live presence chip — mirrors what's burned into the recording.
          Floats inside the recorder card so it's visible while idle AND
          while recording (the browser hides DOM overlays from the shared
          screen surface, so this lives in-app, not on the capture). */}
      {showPresenceChip && (
        <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col items-center gap-1.5">
          <div className="relative w-[88px] h-[88px] rounded-[26px] overflow-hidden border-2 border-emerald/60 bg-black/70 shadow-[0_0_24px_rgba(34,211,168,0.35)]">
            <video
              ref={camPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {status === "recording" && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            )}
          </div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald/80">
            {ownerFirstName ? `${ownerFirstName} · ${CORNER_LABEL[corner]}` : `LIVE · ${CORNER_LABEL[corner]}`}
          </div>
        </div>
      )}
    </div>
  );
}
