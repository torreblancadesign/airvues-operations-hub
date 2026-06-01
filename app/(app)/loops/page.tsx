// /loops — list page. Shows your own recordings (admins/leads see all).
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoopsBrowser } from "@/components/loops/LoopsBrowser";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";
import { canMutate } from "@/lib/authz";
import { listAllLoops, listLoopsForOwner } from "@/lib/loops";

export const revalidate = 60;

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

      {loops.length > 0 && <LoopsBrowser loops={loops} />}
    </main>
  );
}
