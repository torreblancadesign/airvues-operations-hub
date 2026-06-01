// Public share page — /r/[token]. No auth, no nav. Branded Airvues surface.
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLoopByToken } from "@/lib/loops";
import { incrementLoopViewCount } from "@/lib/mutations/loop";
import { AuroraBackdrop } from "@/components/login/AuroraBackdrop";
import { LiveClock } from "@/components/login/LiveClock";

export const revalidate = 0;

export default async function PublicLoopPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loop = await getLoopByToken(token);
  if (!loop) notFound();

  // Best-effort view count
  incrementLoopViewCount(loop.id, loop.viewCount).catch(() => {});

  const year = new Date().getFullYear();
  const recordedAt = new Date(loop.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="min-h-screen relative bg-bg text-ink overflow-hidden flex flex-col">
      {/* Aurora backdrop — dimmed so it doesn't fight the video */}
      <div className="absolute inset-0 opacity-70 pointer-events-none" aria-hidden="true">
        <AuroraBackdrop />
      </div>

      {/* Header */}
      <header className="relative px-6 sm:px-10 py-5 border-b border-rule/60 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/airvues-mark.png"
            alt="Airvues"
            width={36}
            height={38}
            priority
            className="login-mark"
          />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-faint">
              Airvues
            </div>
            <div className="text-[14px] font-semibold text-ink-strong leading-none mt-1">
              Loops
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-ink-faint">
          ◆ Shared recording
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(34, 211, 168, 0.45), transparent)",
          }}
          aria-hidden="true"
        />
      </header>

      {/* Player */}
      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-10">
        <div className="w-full max-w-5xl space-y-5">
          <div className="relative bg-surface/85 backdrop-blur-xl border border-rule rounded-card overflow-hidden shadow-2xl">
            <div
              className="absolute top-0 left-10 right-10 h-px z-10"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(34, 211, 168, 0.55), transparent)",
              }}
              aria-hidden="true"
            />
            <video
              src={loop.videoUrl}
              poster={loop.posterUrl ?? undefined}
              controls
              autoPlay
              className="w-full bg-black aspect-video block"
            />
          </div>

          <div className="px-1 sm:px-2">
            <h1 className="text-[24px] sm:text-[28px] font-semibold text-ink-strong leading-tight tracking-tight">
              {loop.title}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">
              {loop.ownerName && <span>Recorded by {loop.ownerName}</span>}
              {loop.ownerName && <span aria-hidden="true">·</span>}
              <span className="tabnum">{recordedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative px-6 sm:px-10 py-4 border-t border-rule/60 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink-faint backdrop-blur-sm">
        <span>Airvues LLC · © {year}</span>
        <span className="hidden sm:inline">Powered by Airvues Loops</span>
        <LiveClock />
      </footer>
    </main>
  );
}
