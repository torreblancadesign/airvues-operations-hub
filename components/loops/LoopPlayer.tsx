"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalStorageJSON } from "@/lib/use-local-storage";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

type Props = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  storageKey: string;
};

export function LoopPlayer({ src, poster, autoPlay, className, storageKey }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [rate, setRate] = useLocalStorageJSON<Speed>(storageKey, 1);
  const [open, setOpen] = useState(false);

  // Apply rate whenever it changes, and re-apply on metadata load (browsers
  // reset playbackRate when the source loads).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    const onLoaded = () => {
      v.playbackRate = rate;
    };
    v.addEventListener("loadedmetadata", onLoaded);
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [rate]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        autoPlay={autoPlay}
        className={className ?? "w-full rounded-card border border-rule bg-black aspect-video"}
      />
      <div className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-1 rounded bg-surface/85 backdrop-blur border border-rule text-[10px] font-mono uppercase tracking-wider text-ink-muted hover:text-emerald hover:border-emerald/40 transition"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {rate}× speed
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-1 min-w-[6rem] bg-surface/95 backdrop-blur border border-rule rounded shadow-xl overflow-hidden"
          >
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="menuitemradio"
                aria-checked={s === rate}
                onClick={() => {
                  setRate(s);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-[11px] font-mono tabnum tracking-wider transition ${
                  s === rate
                    ? "bg-emerald/15 text-emerald"
                    : "text-ink-muted hover:bg-rule/40 hover:text-ink-strong"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
