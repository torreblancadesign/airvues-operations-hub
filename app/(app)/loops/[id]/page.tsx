// /loops/[id] — detail page with player + share link + tags + delete.
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/PageHeader";
import { CopyShareLink } from "@/components/loops/CopyShareLink";
import { DeleteLoopButton } from "@/components/loops/DeleteLoopButton";
import { LoopTagsEditor } from "@/components/loops/LoopTagsEditor";
import { AiSummaryPanel } from "@/components/loops/AiSummaryPanel";
import { RegenerateAnalysisButton } from "@/components/loops/RegenerateAnalysisButton";
import { getLoopById } from "@/lib/loops";
import { canMutate } from "@/lib/authz";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";
import { listAllClients } from "@/lib/clients";
import { listQuoteOptions } from "@/lib/quotes-light";

export const revalidate = 60;
// Regenerate analysis can re-run the ffmpeg + Gemini pipeline; give it room.
export const maxDuration = 300;

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

  // Only fetch option lists if the editor will render
  const [clientRows, quoteRows] = canEditTags
    ? await Promise.all([listAllClients(), listQuoteOptions()])
    : [[], []];
  const clientOptions = clientRows
    .map((c) => ({ id: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const quoteOptions = quoteRows.map((q) => ({ id: q.id, label: q.label }));

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title={loop.title}
        subtitle={`${loop.ownerName ?? "Unknown"} · ${new Date(loop.createdAt).toLocaleString()}`}
        meta={
          <Link
            href="/loops"
            className="text-[12px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition"
          >
            ← All loops
          </Link>
        }
      />

      <div className="space-y-4">
        <video
          src={loop.videoUrl}
          poster={loop.posterUrl ?? undefined}
          controls
          className="w-full rounded-card border border-rule bg-black aspect-video"
        />

        <div className="bg-surface border border-rule rounded-card p-4 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
            Public share link
          </div>
          <CopyShareLink url={shareUrl} />
          <p className="text-[11px] text-ink-faint">
            Anyone with this link can watch. No sign-in required.
          </p>
        </div>

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
            <div className="bg-surface border border-rule rounded-card p-4 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint">
                Tags
              </div>
              <div className="flex flex-wrap gap-2 text-[12px]">
                {loop.linkedClientId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald/10 border border-emerald/25 text-emerald">
                    <span className="font-mono uppercase tracking-wider text-[10px] opacity-60">Client</span>
                    {loop.linkedClientName ?? loop.linkedClientId}
                  </span>
                )}
                {loop.linkedQuoteId && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300">
                    <span className="font-mono uppercase tracking-wider text-[10px] opacity-60">Quote</span>
                    {loop.linkedQuoteName ?? loop.linkedQuoteId}
                  </span>
                )}
              </div>
            </div>
          )
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">
              AI summary
            </div>
            {canDelete && <RegenerateAnalysisButton id={loop.id} />}
          </div>
          <AiSummaryPanel
            summary={loop.summary}
            keyNotes={loop.keyNotes}
            actionItems={loop.actionItems}
            questions={loop.questions}
            variant="internal"
          />
        </div>

        {loop.transcript && (
          <details className="bg-surface border border-rule rounded-card p-4 group">
            <summary className="cursor-pointer text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-emerald transition">
              Full transcript
            </summary>
            <div className="mt-3 text-[12.5px] leading-relaxed text-ink-muted whitespace-pre-wrap font-mono">
              {loop.transcript}
            </div>
          </details>
        )}


        <div className="flex items-center justify-between gap-4 text-[12px] font-mono text-ink-faint">
          <div>
            {loop.viewCount} view{loop.viewCount === 1 ? "" : "s"}
            {loop.sizeMb && ` · ${loop.sizeMb.toFixed(1)} MB`}
          </div>
          {canDelete && <DeleteLoopButton id={loop.id} />}
        </div>
      </div>
    </main>
  );
}
