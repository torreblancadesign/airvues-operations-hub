import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/client-detail";
import { listPeopleOptions } from "@/lib/quotes";
import { listSprintOptions } from "@/lib/sprints";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";
import { ClientDetailView } from "@/components/clients/ClientDetailView";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertCanAccess("/clients");
  const { id } = await params;

  let detail: Awaited<ReturnType<typeof getClientDetail>>;
  let people: Awaited<ReturnType<typeof listPeopleOptions>> = [];
  let sprints: Awaited<ReturnType<typeof listSprintOptions>> = [];
  try {
    [detail, people, sprints] = await Promise.all([
      getClientDetail(id),
      listPeopleOptions().catch(() => []),
      listSprintOptions().catch(() => []),
    ]);
  } catch {
    notFound();
  }

  const canEdit = await canMutate();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink-strong mb-3"
      >
        ← All clients
      </Link>
      <ClientDetailView
        detail={detail}
        people={people}
        sprints={sprints}
        canEdit={canEdit}
      />
    </main>
  );
}
