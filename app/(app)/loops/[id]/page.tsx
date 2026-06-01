// /loops/[id] — detail page with player + share link + delete.
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/PageHeader";
import { CopyShareLink } from "@/components/loops/CopyShareLink";
import { DeleteLoopButton } from "@/components/loops/DeleteLoopButton";
import { getLoopById } from "@/lib/loops";
import { canMutate } from "@/lib/authz";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";

export const revalidate = 60;

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
  const canDelete = isAdmin || (!!me && me.id === loop.ownerId);

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
