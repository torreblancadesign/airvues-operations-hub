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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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

  // Dismiss the speed menu the way a menu is expected to dismiss: click away or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        autoPlay={autoPlay}
        className={className ?? "aspect-video w-full rounded-card border border-rule bg-black"}
      />
      <div className="absolute right-2 top-2 z-10">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-rule bg-surface/85 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-muted backdrop-blur transition-colors hover:border-emerald/40 hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {rate}× speed
        </button>
        {open && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Playback speed"
            className="absolute right-0 mt-1 min-w-[6rem] overflow-hidden rounded border border-rule bg-surface/95 shadow-xl backdrop-blur"
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
                  triggerRef.current?.focus();
                }}
                className={`block w-full px-3 py-1.5 text-left font-mono text-[11px] tabnum tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald/70 ${
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
