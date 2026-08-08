// Retainer plan catalog — rates, included hours, and SLA response windows.
// This is where the SLA engine gets its numbers; every column is blank until
// a manager fills it, and a blank column means "not covered", never a breach.
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanCatalog } from "@/components/retainers/PlanCatalog";
import { assertCanAccess } from "@/lib/page-guard";
import { canMutate } from "@/lib/authz";
import { listRetainerTiers } from "@/lib/retainers";
import { listCompanyOptions, type CompanyOption } from "@/lib/retainer-companies";
import type { RetainerTier } from "@/lib/retainer-types";

export const revalidate = 300;

export default async function RetainerPlansRoute() {
  await assertCanAccess("/retainers/plans");

  const canEdit = await canMutate();
  let tiers: RetainerTier[] = [];
  let companies: CompanyOption[] = [];
  let error: string | null = null;

  try {
    [tiers, companies] = await Promise.all([listRetainerTiers(), listCompanyOptions()]);
  } catch (e) {
    error = (e as Error).message;
  }

  const uncovered = tiers.filter(
    (t) => t.active && Object.values(t.slaHours).every((h) => h === null),
  ).length;

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Retainer Plans"
        subtitle="Rates, included hours, and first-response promises. Clocks run 9am–6pm Mon–Fri Pacific."
        meta={
          <div className="font-mono tabnum">
            {tiers.length} plan{tiers.length === 1 ? "" : "s"}
          </div>
        }
      />

      {error ? (
        <div className="bg-surface border border-red/30 rounded-card p-6 text-[13px] text-red">
          Failed to load plans: {error}
        </div>
      ) : (
        <>
          {uncovered > 0 && (
            <div className="bg-surface border border-amber/30 rounded-card px-4 py-2.5 text-[12px] text-amber mb-4">
              {uncovered} active plan{uncovered === 1 ? " has" : "s have"} no response times set.
              Requests on {uncovered === 1 ? "it" : "them"} are recorded but never measured.
            </div>
          )}
          <PlanCatalog tiers={tiers} companies={companies} canEdit={canEdit} />
        </>
      )}
    </main>
  );
}
