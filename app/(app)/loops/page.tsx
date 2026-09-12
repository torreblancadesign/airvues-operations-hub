// /loops — list page. Everyone signed in sees every recording.
import Link from "next/link";
import { headers } from "next/headers";
import { CircleAlert, Video } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoopsBrowser } from "@/components/loops/LoopsBrowser";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";
import { listAllLoops } from "@/lib/loops";
import { formatLoopDate } from "@/lib/loops-types";

export const revalidate = 60;

const NEW_LOOP_BUTTON =
  "inline-flex items-center gap-2 rounded-md border border-emerald/30 bg-emerald/15 px-4 py-2 text-[13px] font-medium text-emerald transition-colors hover:bg-emerald/25 hover:border-emerald/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export default async function LoopsPage() {
  let loops: Awaited<ReturnType<typeof listAllLoops>> = [];
  let loadError: string | null = null;
  try {
    loops = await listAllLoops();
  } catch (e) {
    loadError = (e as Error).message;
  }

  // Resolve the viewer's People recId so we can highlight their own cards.
  // Best-effort: failures just disable the highlight.
  let viewerOwnerId: string | null = null;
  try {
    const session = await getAppSession();
    const me = await resolvePersonByEmail(session?.user?.email);
    viewerOwnerId = me?.id ?? null;
  } catch {
    viewerOwnerId = null;
  }

  // Share links are built server-side so the cards can offer copy-link without
  // waiting on hydration to learn the origin.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "airvues-ops.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const shareOrigin = `${proto}://${host}`;

  // Dates are formatted here, not in the client grid — see formatLoopDate.
  const now = new Date();
  const cards = loops.map((l) => ({ ...l, dateLabel: formatLoopDate(l.createdAt, now) }));

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-5">
      <PageHeader
        title="Loops"
        subtitle="Internal screen recordings. Record once, share a link."
        meta={
          <Link href="/loops/new" className={NEW_LOOP_BUTTON}>
            <Video aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
            New Loop
          </Link>
        }
      />

      {loadError && (
        <div className="mb-4 flex gap-3 rounded-card border border-red/30 bg-surface p-4">
          <CircleAlert
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-px h-4 w-4 shrink-0 text-red"
          />
          <div>
            <p className="text-[13px] text-red">Couldn&apos;t load recordings: {loadError}</p>
            <p className="mt-1 text-[12px] text-ink-muted">
              If this is the first run, make sure the &quot;Recordings&quot; table exists in
              Airtable.
            </p>
          </div>
        </div>
      )}

      {!loadError && loops.length === 0 && (
        <div className="rounded-card border border-rule bg-surface px-6 py-16 text-center">
          <Video aria-hidden="true" strokeWidth={1.25} className="mx-auto h-9 w-9 text-ink-faint" />
          <h2 className="mt-4 text-[15px] font-medium text-ink-strong">No recordings yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
            Record your screen and mic in the browser. Every Loop gets an AI summary and a public
            link you can send to a client.
          </p>
          <Link href="/loops/new" className={`${NEW_LOOP_BUTTON} mt-6`}>
            <Video aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />
            Record your first Loop
          </Link>
        </div>
      )}

      {loops.length > 0 && (
        <LoopsBrowser loops={cards} viewerOwnerId={viewerOwnerId} shareOrigin={shareOrigin} />
      )}
    </main>
  );
}
