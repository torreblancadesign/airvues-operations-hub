// /loops — list page. Shows your own recordings (admins/leads see all).
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";
import { canMutate } from "@/lib/authz";
import { listAllLoops, listLoopsForOwner } from "@/lib/loops";

export const revalidate = 60;

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default async function LoopsPage() {
  const session = await getAppSession();
  const isAdmin = await canMutate();

  let loops: Awaited<ReturnType<typeof listAllLoops>> = [];
  let loadError: string | null = null;
  try {
    if (isAdmin) {
      loops = await listAllLoops();
    } else {
      const person = await resolvePersonByEmail(session?.user?.email);
      loops = person ? await listLoopsForOwner(person.id) : [];
    }
  } catch (e) {
    loadError = (e as Error).message;
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Loops"
        subtitle="Internal screen recordings. Record once, share a link."
        meta={
          <Link
            href="/loops/new"
            className="inline-block px-4 py-2 rounded-md bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/20 text-[13px] font-medium transition"
          >
            New Loop
          </Link>
        }
      />

      {loadError && (
        <div className="bg-surface border border-red/30 rounded-card p-4 text-[13px] text-red mb-4">
          Couldn&apos;t load recordings: {loadError}
          <div className="mt-2 text-ink-muted text-[12px]">
            If this is the first run, make sure the &quot;Recordings&quot; table exists in Airtable.
          </div>
        </div>
      )}

      {!loadError && loops.length === 0 && (
        <div className="bg-surface border border-rule rounded-card p-8 text-center">
          <p className="text-[14px] text-ink-muted">No recordings yet.</p>
          <Link
            href="/loops/new"
            className="inline-block mt-3 px-4 py-2 rounded-md bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/20 text-[13px] font-medium transition"
          >
            Record your first Loop
          </Link>
        </div>
      )}

      {loops.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loops.map((loop) => (
            <Link
              key={loop.id}
              href={`/loops/${loop.id}`}
              className="group bg-surface border border-rule rounded-card overflow-hidden hover:border-emerald/40 transition"
            >
              <div className="aspect-video bg-black/40 relative">
                {loop.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={loop.posterUrl}
                    alt={loop.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-faint text-[12px] font-mono">
                    No preview
                  </div>
                )}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                  {fmtDuration(loop.durationSec)}
                </div>
              </div>
              <div className="p-3 space-y-1">
                <div className="text-[13px] font-medium text-ink-strong group-hover:text-emerald line-clamp-2">
                  {loop.title}
                </div>
                <div className="text-[11px] font-mono text-ink-faint flex items-center justify-between">
                  <span>{loop.ownerName ?? "—"}</span>
                  <span>{new Date(loop.createdAt).toLocaleDateString()}</span>
                </div>
                {loop.viewCount > 0 && (
                  <div className="text-[10px] font-mono text-ink-faint">
                    {loop.viewCount} view{loop.viewCount === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
