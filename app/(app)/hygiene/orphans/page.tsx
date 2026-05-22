// /hygiene/orphans — bulk-triage UI for the 528 stories with no engineer assigned.
// Groups orphans by parent Quote, suggests the engineer from Quote.Prepared by,
// one-click bulk-assign per group.
import { PageHeader } from "@/components/ui/PageHeader";
import { OrphanTriage } from "@/components/hygiene/OrphanTriage";
import { getOrphanTriage } from "@/lib/orphan-triage";
import { canMutate } from "@/lib/authz";
import { assertCanAccess } from "@/lib/page-guard";

export const revalidate = 60;

export default async function OrphanTriagePage() {
  await assertCanAccess("/hygiene");
  const editable = await canMutate();

  let data;
  try {
    data = await getOrphanTriage();
  } catch (err) {
    return (
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <PageHeader title="Orphan Story Triage" />
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load triage data: {(err as Error).message}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Orphan Story Triage"
        subtitle="Stories with no engineer assigned, grouped by parent Quote. One-click bulk-assign per group. Suggested engineer comes from Quote.Prepared by."
        meta={
          <>
            <div className="font-mono tabnum">
              {data.totalOrphans.toLocaleString()} orphans · {data.groups.length} groups
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {editable ? "Bulk-assign live · admin/lead only" : "Read-only · sign in as admin"}
            </div>
          </>
        }
      />
      <OrphanTriage data={data} canEdit={editable} />
    </main>
  );
}