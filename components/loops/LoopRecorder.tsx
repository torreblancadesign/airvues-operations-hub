"use client";

// Browser-native screen + mic recorder with optional Airvues face-bubble overlay.
// Captures via getDisplayMedia + getUserMedia, optionally composites a webcam
// "presence bubble" via a canvas pipeline so the face is BURNED INTO the file,
// encodes via MediaRecorder, uploads direct-to-Vercel-Blob, then persists
// metadata via the createLoop server action.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { createLoop } from "@/lib/mutations/loop";
import { sanitizeUploadFilename } from "@/lib/uploads";
import { useLocalStorageJSON } from "@/lib/use-local-storage";

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

// Bubble geometry, as fractions of the recorded frame. The on-page preview
// renders from these same numbers, so what you place is what gets burned in.
const BUBBLE_OF_SHORT_SIDE = 0.18;
// Only binds if the 1080p capture constraint was ignored; the preview doesn't
// model it, so an uncapped frame would show a slightly large bubble.
const BUBBLE_MAX_PX = 240;
const SIDE_MARGIN_OF_BUBBLE = 0.22;
// The browser overlays its "Stop sharing" bar bottom-centre (~110px on a
// 1080-tall frame); bottom-corner bubbles sit above it.
const SHARE_BAR_OF_HEIGHT = 110 / 1080;

function bubblePx(frameW: number, frameH: number) {
  const size = Math.min(
    Math.floor(Math.min(frameW, frameH) * BUBBLE_OF_SHORT_SIDE),
    BUBBLE_MAX_PX,
  );
  const side = Math.floor(size * SIDE_MARGIN_OF_BUBBLE);
  return {
    size,
    side,
    bottom: Math.max(side, Math.round(frameH * SHARE_BAR_OF_HEIGHT)),
  };
}

function circlePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
  ctx.closePath();
}

// Generate a 1-frame poster JPEG from the recorded blob.
async function makePoster(videoBlob: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(videoBlob);
  try {
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
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  title: string;
  linkedClientId: string | null;
  linkedQuoteId: string | null;
};

const MIC_KEY = "loops:micDeviceId";

const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

const CORNER_LABEL: Record<Corner, string> = {
  br: "Bottom right",
  bl: "Bottom left",
  tr: "Top right",
  tl: "Top left",
};

export function LoopRecorder({
  title,
  linkedClientId,
  linkedQuoteId,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Face-bubble controls
  const [faceOn, setFaceOn] = useState(false);
  const [corner, setCorner] = useState<Corner>("br");
  // The placement stage mirrors the user's own screen shape, so a bubble
  // parked in a corner sits where they saw it.
  const [stageAspect, setStageAspect] = useState(16 / 9);
  useEffect(() => {
    const a = window.screen?.width / window.screen?.height;
    if (Number.isFinite(a) && a > 0.5 && a < 4) setStageAspect(a);
  }, []);
  const [camPreviewStream, setCamPreviewStream] = useState<MediaStream | null>(
    null,
  );
  const camPreviewStreamRef = useRef<MediaStream | null>(null);
  const camPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Mic selection. Recording with the laptop mic when an audio interface is
  // plugged in is the usual way a Loop comes back with no usable audio, so the
  // device is explicit and remembered rather than left to the system default.
  const [micId, setMicId] = useLocalStorageJSON<string>(MIC_KEY, "");
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  // The meter bar is written straight to the DOM. Putting the level in React
  // state re-rendered this whole component ~60x/second, which made the camera
  // preview stutter. Only the crossed-threshold flag is state.
  const [micHot, setMicHot] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const meterRef = useRef<HTMLDivElement | null>(null);
  // Bumped by every start/stop so an in-flight getUserMedia that resolves
  // after a stop discards its stream instead of reviving the monitor.
  const monitorGenRef = useRef(0);
  const enablingFaceRef = useRef(false);
  const monitorRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    raf: number;
  } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startTsRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const stopDrawRef = useRef<boolean>(false);
  const readersRef = useRef<ReadableStreamDefaultReader<VideoFrame>[]>([]);
  const composedRef = useRef<MediaStream | null>(null);

  // Browser support gate
  const [supported, setSupported] = useState<boolean | null>(null);
  // The face bubble composites through MediaStreamTrackProcessor (Chrome/Edge).
  // Without it the only alternative is a compositor-driven ticker, which
  // silently freezes the video whenever the tab is backgrounded — so we hide
  // the option rather than hand someone a broken recording.
  const [faceSupported, setFaceSupported] = useState(true);
  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
        typeof window.MediaRecorder === "function",
    );
    setFaceSupported(typeof window.MediaStreamTrackProcessor === "function");
  }, []);

  // Guards while recording. beforeunload covers reloads and tab closes; it does
  // NOT fire on a Next.js client-side navigation, which unmounts this component
  // and destroys the take with no warning. Catching link clicks in the capture
  // phase covers the sidebar, mobile nav and home cards — i.e. how people
  // actually leave this page.
  //
  // ponytail: anchor clicks only. A programmatic router.push (the Cmd+K
  // palette) still slips through; covering that needs a real App Router
  // navigation guard, which Next 14 doesn't expose.
  useEffect(() => {
    if (status !== "recording") return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!link || link.target === "_blank") return;
      // Same-document jumps and downloads aren't leaving the page.
      if (link.hasAttribute("download")) return;
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      if (link.origin !== window.location.origin) return;
      if (link.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      setError("Stop the recording first — leaving this page would lose it.");
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
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

  const refreshMics = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setMics(
        all.filter((d) => d.kind === "audioinput" && d.deviceId),
      );
    } catch {
      /* enumeration is best-effort */
    }
  }, []);

  const stopMonitor = useCallback(() => {
    monitorGenRef.current += 1;
    const m = monitorRef.current;
    monitorRef.current = null;
    setMonitoring(false);
    setMicHot(false);
    if (meterRef.current) meterRef.current.style.width = "0%";
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((t) => t.stop());
    m.ctx.close().catch(() => {});
  }, []);

  // Opens the chosen input and drives a peak meter, so a dead mic is obvious
  // BEFORE recording instead of after. Also unlocks device labels, which the
  // browser withholds until microphone permission has been granted once.
  const startMonitor = useCallback(
    async (deviceId: string) => {
      stopMonitor();
      const gen = monitorGenRef.current;
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: deviceId ? { deviceId: { exact: deviceId } } : true,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        if (monitorGenRef.current !== gen) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const entry = { stream, ctx, raf: 0 };
        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) {
            const d = Math.abs(buf[i] - 128);
            if (d > peak) peak = d;
          }
          const level = Math.min(1, peak / 96);
          if (meterRef.current) {
            meterRef.current.style.width = `${(level * 100).toFixed(1)}%`;
          }
          // Flip the label only on a real transition, not every frame.
          const hot = level > 0.02;
          setMicHot((prev) => (prev === hot ? prev : hot));
          if (monitorRef.current === entry) {
            entry.raf = requestAnimationFrame(tick);
          }
        };
        monitorRef.current = entry;
        entry.raf = requestAnimationFrame(tick);
        setMonitoring(true);
        await refreshMics();
      } catch {
        setError("Couldn't open that microphone — is it in use by another app?");
      }
    },
    [refreshMics, stopMonitor],
  );

  // Enumerate on mount and whenever a peripheral is plugged in or pulled out.
  useEffect(() => {
    void refreshMics();
    const onChange = () => void refreshMics();
    navigator.mediaDevices?.addEventListener("devicechange", onChange);
    return () =>
      navigator.mediaDevices?.removeEventListener("devicechange", onChange);
  }, [refreshMics]);

  // Only auto-open the meter when mic permission is already granted, so loading
  // the page never triggers an unprompted permission dialog.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const st = await navigator.permissions?.query({
          name: "microphone" as PermissionName,
        });
        if (cancelled || st?.state !== "granted") return;
        // Read storage directly — micId hasn't hydrated yet on this pass.
        let saved = "";
        try {
          saved = JSON.parse(window.localStorage.getItem(MIC_KEY) || '""');
        } catch {
          /* fall back to the system default */
        }
        await startMonitor(saved);
      } catch {
        /* Firefox doesn't expose the microphone permission name */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => stopMonitor, [stopMonitor]);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  const stopCamPreview = useCallback(() => {
    camPreviewStreamRef.current?.getTracks().forEach((t) => t.stop());
    camPreviewStreamRef.current = null;
    setCamPreviewStream(null);
  }, []);

  const enableFace = useCallback(async () => {
    if (enablingFaceRef.current) return;
    enablingFaceRef.current = true;
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
    } finally {
      enablingFaceRef.current = false;
    }
  }, []);

  const disableFace = useCallback(() => {
    setFaceOn(false);
    stopCamPreview();
  }, [stopCamPreview]);

  const cleanupStreams = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    composedRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micStreamRef.current = null;
    composedRef.current = null;
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
    // Release the track processors. Without this the camera track — which we
    // keep alive on purpose — stays claimed and the NEXT recording gets no
    // frames. cancel() also resolves the pending read() so the loops exit.
    readersRef.current.forEach((r) => {
      r.cancel().catch(() => {});
    });
    readersRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting");
    // Free the monitor first: exclusive-mode interfaces refuse a second opener.
    const hadMonitor = monitorRef.current !== null;
    stopMonitor();
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } } as MediaTrackConstraints,
        audio: true,
      });
      streamRef.current = display;

      // Cap the capture at 1080p BEFORE anything reads its settings. A
      // 5120x2880 retina share starves the VP9 encoder — measured 18.8fps and
      // 70MB for a 3-minute loop. Downscaling in the capturer is free.
      try {
        await display.getVideoTracks()[0]?.applyConstraints({
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { ideal: 30 },
        });
      } catch {
        /* best-effort — some browsers ignore display-track constraints */
      }

      // Mic (optional). Honor the chosen input, but fall back to the system
      // default rather than recording silence if that peripheral was unplugged
      // since it was picked.
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: micId ? { deviceId: { exact: micId } } : true,
        });
      } catch {
        try {
          mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          mic = null;
        }
      }
      micStreamRef.current = mic;

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
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas 2D context unavailable");

        const drawStart = performance.now();
        const {
          size: bubbleSize,
          side: sideMargin,
          bottom: bottomMargin,
        } = bubblePx(canvasW, canvasH);
        const cornerForFrame = corner;

        stopDrawRef.current = false;

        const drawFrame = (
          screen: VideoFrame | null,
          face: VideoFrame | null,
        ) => {
          if (stopDrawRef.current) return;

          // Background = full screen (downscaled into canvas)
          if (screen) {
            try {
              ctx.drawImage(screen, 0, 0, canvasW, canvasH);
            } catch {
              /* frame already closed */
            }
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

          // A real drop shadow (offset + blur) so the bubble sits ON the
          // screen. A zero-offset glow just reads as decoration.
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = Math.round(bubbleSize * 0.1);
          ctx.shadowOffsetY = Math.round(bubbleSize * 0.04);
          ctx.fillStyle = "rgb(11, 15, 23)";
          circlePath(ctx, bx, by, bubbleSize);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Clip to the circle and draw webcam (cover-fit, mirrored)
          ctx.save();
          circlePath(ctx, bx, by, bubbleSize);
          ctx.clip();
          const cw = face?.displayWidth || 1;
          const ch = face?.displayHeight || 1;
          const scale = Math.max(bubbleSize / cw, bubbleSize / ch);
          const dw = cw * scale;
          const dh = ch * scale;
          const dx = bx + (bubbleSize - dw) / 2;
          const dy = by + (bubbleSize - dh) / 2;
          ctx.translate(dx + dw, dy);
          ctx.scale(-1, 1);
          if (face) {
            try {
              ctx.drawImage(face, 0, 0, dw, dh);
            } catch {
              /* frame already closed */
            }
          }
          ctx.restore();

          // Emerald ring, drawn inside the edge so it never gets clipped.
          const ring = Math.max(2, bubbleSize * 0.02);
          ctx.lineWidth = ring;
          ctx.strokeStyle = "rgba(34, 211, 168, 0.9)";
          circlePath(ctx, bx + ring / 2, by + ring / 2, bubbleSize - ring);
          ctx.stroke();

          ctx.restore();
        };

        // Manually-driven canvas capture: emit a frame ONLY after we draw,
        // so each emitted video frame is timestamped at draw time and the
        // muxer keeps audio/video locked together (no progressive A/V drift).
        const canvasStream = canvas.captureStream(0);
        const canvasVideoTrack = canvasStream.getVideoTracks()[0] as
          | (MediaStreamTrack & { requestFrame?: () => void });

        // Pull frames straight off the capture pipeline rather than the page's
        // compositor. The rVFC/rAF tickers this replaces BOTH stop firing the
        // moment the tab is backgrounded — which is exactly what you do after
        // hitting record, so video froze at ~1s while audio kept going.
        // MediaStreamTrackProcessor is fed by the browser's capture process
        // and keeps delivering regardless of tab visibility.
        const readerFor = (track: MediaStreamTrack) =>
          new MediaStreamTrackProcessor({ track }).readable.getReader();

        // The webcam is the clock: it runs at a steady hardware 30fps, whereas
        // screen capture is damage-driven and goes quiet on a static screen.
        let latestScreen: VideoFrame | null = null;

        const screenReader = readerFor(display.getVideoTracks()[0]);
        readersRef.current = [screenReader];
        void (async () => {
          try {
            for (;;) {
              const { value, done } = await screenReader.read();
              if (done) break;
              latestScreen?.close();
              latestScreen = value;
              if (stopDrawRef.current) break;
            }
          } catch {
            /* track ended */
          } finally {
            latestScreen?.close();
            latestScreen = null;
          }
        })();

        const faceReader = readerFor(cam.getVideoTracks()[0]);
        readersRef.current.push(faceReader);
        void (async () => {
          try {
            for (;;) {
              const { value: face, done } = await faceReader.read();
              if (done) break;
              if (stopDrawRef.current) {
                face.close();
                break;
              }
              drawFrame(latestScreen, face);
              face.close();
              canvasVideoTrack.requestFrame?.();
            }
          } catch {
            /* track ended */
          }
        })();

        videoTrackForRecorder = canvasVideoTrack;
      } else {
        videoTrackForRecorder = display.getVideoTracks()[0];
      }

      // ── Audio routing ───────────────────────────────────────────────────
      // Only spin up an AudioContext when we genuinely need to MIX two
      // sources (display audio + mic). A single source passes through its
      // own track unmodified — avoids the mixer's buffering latency that
      // was pushing audio behind video.
      const combinedTracks: MediaStreamTrack[] = [videoTrackForRecorder];
      const displayAudio = display.getAudioTracks();

      if (mic && displayAudio.length > 0) {
        const ctx = new AudioContext({ latencyHint: "interactive" });
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        const dispSrc = ctx.createMediaStreamSource(
          new MediaStream(displayAudio),
        );
        dispSrc.connect(dest);
        const micSrc = ctx.createMediaStreamSource(mic);
        micSrc.connect(dest);
        combinedTracks.push(...dest.stream.getAudioTracks());
      } else if (mic) {
        combinedTracks.push(...mic.getAudioTracks());
      } else if (displayAudio.length > 0) {
        combinedTracks.push(...displayAudio);
      }

      const combined = new MediaStream(combinedTracks);
      // Tracks we synthesised (canvas capture, mixer output) have no source to
      // stop them; hold them so cleanupStreams can.
      composedRef.current = combined;

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
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        cleanupStreams();
        setStatus("stopped");
      };

      display.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state === "recording") recorder.stop();
      });

      recorder.start(250);
      startTsRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startTsRef.current) / 1000);
      }, 250);
      setStatus("recording");
    } catch (e) {
      cleanupStreams();
      // Back to idle, not a dead "error" state: the Start button has to come
      // back or a dismissed screen picker means reloading the page.
      setStatus("idle");
      setError((e as Error).message || "Failed to start recording");
      if (hadMonitor) void startMonitor(micId);
    }
  }, [
    cleanupStreams,
    faceOn,
    camPreviewStream,
    corner,
    micId,
    stopMonitor,
    startMonitor,
  ]);

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
      // The blob is still in hand; "stopped" restores Save & upload + Discard
      // instead of stranding a finished recording.
      setStatus("stopped");
      setError((e as Error).message || "Upload failed");
    }
  }, [title, elapsed, linkedClientId, linkedQuoteId, router]);

  useEffect(
    () => () => {
      // Stop the recorder BEFORE the tracks so it finalises rather than dying
      // mid-chunk. A soft nav away from this page still loses the take — the
      // beforeunload guard below only covers a real page unload.
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      cleanupStreams();
    },
    [cleanupStreams],
  );
  // Unmount-only: stop the live camera preview when the component goes away.
  // Do NOT depend on stopCamPreview here — its identity churn used to fire this
  // cleanup mid-session and kill the webcam track.
  useEffect(() => {
    return () => {
      camPreviewStreamRef.current?.getTracks().forEach((t) => t.stop());
      camPreviewStreamRef.current = null;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
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

  // Percentages of the stage, derived from the same fractions bubblePx() uses
  // for the real canvas — so the preview can't drift from the recording.
  const bubbleH = BUBBLE_OF_SHORT_SIDE * 100;
  const bubbleW = bubbleH / stageAspect;
  const marginY = bubbleH * SIDE_MARGIN_OF_BUBBLE;
  const marginX = marginY / stageAspect;
  const bottomY = Math.max(marginY, SHARE_BAR_OF_HEIGHT * 100);

  // Absolute top/left for every corner (rather than top/right/bottom/left)
  // so the bubble can animate between them.
  const bubbleStyle = (c: Corner): CSSProperties => ({
    height: `${bubbleH}%`,
    aspectRatio: "1",
    left: `${c === "tl" || c === "bl" ? marginX : 100 - marginX - bubbleW}%`,
    top: `${c === "tl" || c === "tr" ? marginY : 100 - bottomY - bubbleH}%`,
  });

  const canConfigure = status === "idle";
  const showStage =
    faceOn && (status === "idle" || status === "recording" || status === "requesting");

  return (
    <div className="bg-gradient-to-b from-surface to-surface/60 border border-rule rounded-card p-5 sm:p-6 space-y-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
      {/* Face bubble controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={faceOn ? disableFace : enableFace}
          disabled={!canConfigure || !faceSupported}
          className={`relative inline-flex items-center h-6 w-11 rounded-full transition border ${
            faceOn ? "bg-emerald/25 border-emerald/50" : "bg-surface/60 border-rule"
          } ${!canConfigure || !faceSupported ? "opacity-50 cursor-not-allowed" : ""}`}
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
            {faceSupported
              ? "Burned into the recording"
              : "Requires Chrome or Edge"}
          </div>
        </div>
      </div>

      {/* Microphone picker + live peak meter */}
      <div className="flex items-center gap-3 flex-wrap pt-4 border-t border-rule/60">
        <label
          htmlFor="loop-mic"
          className="text-[10px] font-mono uppercase tracking-wider text-ink-faint"
        >
          Mic
        </label>
        <select
          id="loop-mic"
          value={micId}
          onChange={(e) => {
            setMicId(e.target.value);
            void startMonitor(e.target.value);
          }}
          disabled={!canConfigure}
          className="bg-surface/40 border border-rule rounded-md px-2.5 py-1.5 text-[12px] text-ink-strong focus:outline-none focus:border-emerald/50 disabled:opacity-50 max-w-[260px]"
        >
          <option value="">System default</option>
          {mics.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${i + 1}`}
            </option>
          ))}
        </select>

        {monitoring ? (
          <div className="flex items-center gap-2">
            <div
              aria-hidden="true"
              className="h-1.5 w-28 rounded-full bg-surface/70 border border-rule overflow-hidden"
            >
              <div
                ref={meterRef}
                className={micHot ? "h-full bg-emerald" : "h-full bg-rule"}
                style={{ width: "0%" }}
              />
            </div>
            <span
              role="status"
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint"
            >
              {micHot ? "hearing you" : "silent"}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void startMonitor(micId)}
            disabled={!canConfigure}
            className="text-[10px] font-mono uppercase tracking-wider text-emerald/90 hover:text-emerald underline underline-offset-2 disabled:opacity-50"
          >
            Test mic
          </button>
        )}
      </div>

      {/* Placement stage — a miniature of the frame that gets recorded, at the
          shape of the user's own screen. Click a corner to move the bubble;
          geometry comes from the same constants the canvas renders with. */}
      {showStage && (
        <div className="pt-4 border-t border-rule/60">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="text-[11px] text-ink-muted">
              {canConfigure
                ? "Click a corner to place your bubble."
                : `Recording with your bubble ${CORNER_LABEL[corner].toLowerCase()}.`}
            </p>
            {status === "recording" && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-red shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
                Recording
              </span>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="Face bubble position"
            className="relative w-full max-w-[440px] rounded-lg border border-rule bg-[#080b11] overflow-hidden"
            style={{ aspectRatio: String(stageAspect) }}
          >
            {/* Screen furniture: enough to read as "your screen", not a drawing
                of one. A title bar, and the share bar the bubble must clear. */}
            <div className="absolute inset-x-0 top-0 h-[8%] bg-white/[0.035] border-b border-white/[0.06]" />
            <div className="absolute left-[2.5%] top-[2.6%] flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-ink-faint/40"
                />
              ))}
            </div>

            {CORNERS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={corner === c}
                aria-label={CORNER_LABEL[c]}
                onClick={() => setCorner(c)}
                disabled={!canConfigure}
                className="absolute rounded-full border border-dashed border-ink-faint/45 transition-colors hover:border-emerald/60 hover:bg-emerald/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 disabled:pointer-events-none disabled:opacity-0"
                style={bubbleStyle(c)}
              />
            ))}

            {/* One element that travels between corners, rather than four that
                mount and unmount — keeps the camera stream attached. */}
            <video
              ref={camPreviewRef}
              autoPlay
              muted
              playsInline
              className="absolute rounded-full object-cover scale-x-[-1] border-2 border-emerald/90 bg-black shadow-[0_4px_14px_rgba(0,0,0,0.55)] pointer-events-none motion-safe:transition-[top,left] motion-safe:duration-300 motion-safe:ease-out"
              style={bubbleStyle(corner)}
            />

            <div className="absolute bottom-[1.5%] left-1/2 -translate-x-1/2 rounded-full bg-white/[0.06] border border-white/[0.07] px-2 py-[0.35rem] text-[9px] font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">
              Stop sharing
            </div>
          </div>
        </div>
      )}

      {/* Recorder header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pt-4 border-t border-rule/60">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-rule bg-surface/50 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
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
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald/70" />
              Ready
            </>
          )}
        </div>
        <div className="flex gap-2">
          {status === "idle" && (
            <button
              onClick={start}
              className="px-5 py-2 rounded-md bg-emerald/15 border border-emerald/40 text-emerald hover:bg-emerald/25 text-[13px] font-semibold transition shadow-[0_0_18px_rgba(34,211,168,0.18)]"
            >
              Start recording
            </button>
          )}
          {status === "recording" && (
            <button
              onClick={stop}
              className="px-5 py-2 rounded-md bg-red/15 border border-red/40 text-red hover:bg-red/25 text-[13px] font-semibold transition"
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
                className="px-5 py-2 rounded-md bg-emerald/15 border border-emerald/40 text-emerald hover:bg-emerald/25 text-[13px] font-semibold transition shadow-[0_0_18px_rgba(34,211,168,0.18)]"
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

      <p className="text-[11px] text-ink-faint leading-snug font-mono pt-4 border-t border-rule/60">
        Tip: pick &quot;Entire screen&quot; in the browser picker to capture your
        whole desktop. System audio is captured on Chrome/Edge when you tick
        &quot;Share system audio.&quot; Safari can&apos;t capture system audio
        (mic still works).
      </p>
    </div>
  );
}
