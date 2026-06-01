// Public share page — /r/[token]. No auth, no nav.
import { notFound } from "next/navigation";
import { getLoopByToken } from "@/lib/loops";
import { incrementLoopViewCount } from "@/lib/mutations/loop";

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

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="font-display text-[18px] tracking-tight">Airvues</div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-white/40">
          Shared Recording
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl space-y-4">
          <video
            src={loop.videoUrl}
            poster={loop.posterUrl ?? undefined}
            controls
            autoPlay
            className="w-full rounded-lg bg-black aspect-video"
          />
          <div>
            <h1 className="text-[20px] font-display tracking-tight">{loop.title}</h1>
            {loop.ownerName && (
              <p className="text-[12px] font-mono uppercase tracking-wider text-white/40 mt-1">
                Recorded by {loop.ownerName}
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="px-6 py-4 border-t border-white/10 text-[11px] font-mono text-white/30 text-center">
        airvues.com
      </footer>
    </main>
  );
}
