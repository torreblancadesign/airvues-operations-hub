// /loops/[id] — detail page. Loom-style split: the player owns the page, the AI
// summary and transcript live in a tabbed rail beside it.
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ChevronLeft, Clock, Eye, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CopyShareLink } from "@/components/loops/CopyShareLink";
import { DeleteLoopButton } from "@/components/loops/DeleteLoopButton";
import { DownloadLoopButton } from "@/components/loops/DownloadLoopButton";
import { LoopTagsEditor } from "@/components/loops/LoopTagsEditor";
import { LoopSidePanel } from "@/components/loops/LoopSidePanel";
import { LoopPlayer } from "@/components/loops/LoopPlayer";
import { RegenerateAnalysisButton } from "@/components/loops/RegenerateAnalysisButton";
import { getLoopById } from "@/lib/loops";
import { formatLoopDuration, loopAnalysisState } from "@/lib/loops-types";
import { canMutate } from "@/lib/authz";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";
import { listAllClients } from "@/lib/clients";
import { listQuoteOptions } from "@/lib/quotes-light";

export const revalidate = 60;
// Regenerate analysis can re-run the ffmpeg + Gemini pipeline; give it room.
export const maxDuration = 300;

const SECTION_LABEL = "text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint";

export default async function LoopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loop = await getLoopById(id);
  if (!loop) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "airvues-ops.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/r/${loop.shareToken}`;

  const session = await getAppSession();
  const isAdmin = await canMutate();
  const me = await resolvePersonByEmail(session?.user?.email);
  const isOwner = !!me && me.id === loop.ownerId;
  const canEditTags = isAdmin || isOwner;
  const canDelete = isAdmin || isOwner;

  const analysis = loopAnalysisState(loop);

  // Only fetch option lists if the editor will render
  const [clientRows, quoteRows] = canEditTags
    ? await Promise.all([listAllClients(), listQuoteOptions()])
    : [[], []];
  const clientOptions = clientRows
    .map((c) => ({ id: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const quoteOptions = quoteRows.map((q) => ({ id: q.id, label: q.label }));

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 sm:py-5">
      <Link
        href="/loops"
        className="mb-3 inline-flex items-center gap-1 rounded font-mono text-[12px] uppercase tracking-wider text-ink-faint transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ChevronLeft aria-hidden="true" strokeWidth={2} className="h-3.5 w-3.5" />
        All loops
      </Link>

      <PageHeader
        title={loop.title}
        subtitle={
          <>
            Recorded by <span className="text-ink-strong">{loop.ownerName ?? "Unknown"}</span> ·{" "}
            <span className="tabnum">{new Date(loop.createdAt).toLocaleString()}</span>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden rounded-card border border-rule bg-black shadow-[0_16px_44px_-20px_rgba(0,0,0,0.9)]">
            <LoopPlayer
              src={loop.videoUrl}
              poster={loop.posterUrl ?? undefined}
              storageKey="loops:playbackRate:internal"
              className="block aspect-video max-h-[calc(100dvh-14rem)] w-full bg-black object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] text-ink-faint">
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
                <span className="tabnum">{formatLoopDuration(loop.durationSec)}</span>
              </span>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5" />
                <span className="tabnum">{loop.viewCount}</span> view
                {loop.viewCount === 1 ? "" : "s"}
              </span>
              {analysis === "pending" && (
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald/30 bg-emerald/10 px-1.5 py-0.5 uppercase tracking-wider text-emerald">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald motion-safe:animate-pulse" />
                  Analyzing
                </span>
              )}
              {analysis === "failed" && (
                <span className="inline-flex items-center gap-1.5 rounded border border-amber/30 bg-amber/10 px-1.5 py-0.5 uppercase tracking-wider text-amber">
                  <TriangleAlert aria-hidden="true" strokeWidth={2} className="h-3 w-3" />
                  No summary
                </span>
              )}
            </div>

            <div className="ml-auto">
              <DownloadLoopButton
                videoUrl={loop.videoUrl}
                title={loop.title}
                sizeMb={loop.sizeMb}
                variant="solid"
              />
            </div>
          </div>
        </div>

        <aside className="min-w-0 lg:row-span-2">
          <LoopSidePanel
            summary={loop.summary}
            keyNotes={loop.keyNotes}
            actionItems={loop.actionItems}
            questions={loop.questions}
            transcript={loop.transcript}
            state={analysis}
            canRegenerate={canDelete}
            regenerateSlot={canDelete ? <RegenerateAnalysisButton id={loop.id} /> : undefined}
          />
        </aside>

        <div className="min-w-0 space-y-4">
          <section className="space-y-2.5 rounded-card border border-rule bg-surface p-4">
            <h2 className={SECTION_LABEL}>Public share link</h2>
            <CopyShareLink url={shareUrl} />
            <p className="text-[11px] text-ink-faint">
              Anyone with this link can watch and download. No sign-in required.
            </p>
          </section>

          {canEditTags ? (
            <LoopTagsEditor
              loopId={loop.id}
              initialClientId={loop.linkedClientId}
              initialQuoteId={loop.linkedQuoteId}
              clients={clientOptions}
              quotes={quoteOptions}
            />
          ) : (
            (loop.linkedClientId || loop.linkedQuoteId) && (
              <section className="space-y-2 rounded-card border border-rule bg-surface p-4">
                <h2 className={SECTION_LABEL}>Tags</h2>
                <div className="flex flex-wrap gap-2 text-[12px]">
                  {loop.linkedClientId && (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald/25 bg-emerald/10 px-2 py-0.5 text-emerald">
                      <span className="font-mono text-[10px] uppercase tracking-wider opacity-60">
                        Client
                      </span>
                      {loop.linkedClientName ?? loop.linkedClientId}
                    </span>
                  )}
                  {loop.linkedQuoteId && (
                    <span className="inline-flex items-center gap-1 rounded border border-sky/25 bg-sky/10 px-2 py-0.5 text-sky">
                      <span className="font-mono text-[10px] uppercase tracking-wider opacity-60">
                        Quote
                      </span>
                      {loop.linkedQuoteName ?? loop.linkedQuoteId}
                    </span>
                  )}
                </div>
              </section>
            )
          )}

          {canDelete && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
              <p className="text-[12px] text-ink-faint">
                Deleting removes this Loop from the dashboard and breaks its public share link.
              </p>
              <DeleteLoopButton id={loop.id} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
