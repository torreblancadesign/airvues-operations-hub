// One download control for all three loop surfaces: /loops cards, /loops/[id], /r/[token].
//
// Deliberately a plain anchor rather than a client component: the file streams
// straight from Blob storage, so downloading needs no JS, costs no function
// bandwidth, and still works with middle-click and "Save link as".
import { Download } from "lucide-react";
import { loopDownloadUrl } from "@/lib/loops-types";

type Variant = "solid" | "ghost" | "overlay";

type Props = {
  videoUrl: string;
  title: string;
  /** Rendered next to the label on `solid` and `ghost` so the weight is known before clicking. */
  sizeMb?: number | null;
  variant?: Variant;
  className?: string;
};

const VARIANTS: Record<Variant, string> = {
  solid:
    "gap-2 px-3 py-1.5 rounded-md bg-emerald/15 border border-emerald/30 text-emerald text-[12px] font-medium hover:bg-emerald/25 hover:border-emerald/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  ghost:
    "gap-2 px-3 py-1.5 rounded-md bg-surface/70 border border-rule text-ink-muted text-[12px] font-medium backdrop-blur hover:text-emerald hover:border-emerald/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  overlay:
    "h-7 w-7 rounded-md bg-black/65 border border-white/15 text-white backdrop-blur-sm hover:bg-black/85 hover:border-emerald/60 hover:text-emerald",
};

export function DownloadLoopButton({
  videoUrl,
  title,
  sizeMb,
  variant = "solid",
  className = "",
}: Props) {
  if (!videoUrl) return null;

  const label = `Download “${title}”`;
  const isOverlay = variant === "overlay";

  return (
    <a
      href={loopDownloadUrl(videoUrl)}
      // Ignored cross-origin — Blob's `?download=1` does the real work — but it
      // keeps the intent legible and covers any same-origin video.
      download
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center justify-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70",
        VARIANTS[variant],
        className,
      ].join(" ")}
    >
      <Download aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
      {!isOverlay && (
        <span>
          Download
          {typeof sizeMb === "number" && sizeMb > 0 && (
            <span className="ml-1.5 font-mono tabnum text-[11px] opacity-60">
              {sizeMb.toFixed(1)} MB
            </span>
          )}
        </span>
      )}
    </a>
  );
}
