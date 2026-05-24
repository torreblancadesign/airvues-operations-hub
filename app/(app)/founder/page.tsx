// /founder — admin-only Founder Dashboard.
// Hard server-side gate via requireRole("admin"). Also gated in nav/page-guard
// via the "Founder" Permission so the route is invisible to anyone without it.
import { redirect } from "next/navigation";
import { requireRole, AuthzError } from "@/lib/authz";
import { assertCanAccess } from "@/lib/page-guard";
import { revenueMtd } from "@/lib/kpi";
import { PageHeader } from "@/components/ui/PageHeader";
import { FounderDashboard } from "@/components/founder/FounderDashboard";

export const revalidate = 300;

export default async function FounderPage() {
  // Permission gate (hides the page from non-Founder permission users).
  await assertCanAccess("/founder");

  // Role gate (defense in depth — only admins can mutate or view this).
  try {
    await requireRole("admin");
  } catch (e) {
    if (e instanceof AuthzError) redirect("/");
    throw e;
  }

  let initialRevenue = 40_000;
  let revenueSource: "mtd" | "default" = "default";
  try {
    const kpi = await revenueMtd();
    if (kpi.value && kpi.value > 0) {
      initialRevenue = kpi.value;
      revenueSource = "mtd";
    }
  } catch {
    // fall back to default
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Founder Dashboard"
        subtitle="Replacement-income command center — track Airvues' path to the $115K/mo goal."
      />
      <FounderDashboard
        initialMonthlyRevenue={initialRevenue}
        revenueSource={revenueSource}
      />
    </main>
  );
}
