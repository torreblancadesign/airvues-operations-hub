import { listAllSubscriptions } from "@/lib/stack";
import { PageHeader } from "@/components/ui/PageHeader";
import { StackDashboard } from "@/components/stack/StackDashboard";
import { assertCanAccess } from "@/lib/page-guard";

export default async function StackPage() {
  await assertCanAccess("/stack");
  let subs: Awaited<ReturnType<typeof listAllSubscriptions>> = [];
  let error: string | null = null;
  try {
    subs = await listAllSubscriptions();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Stack"
        subtitle="Internal SaaS subscriptions · burn rate, cadence, source."
        meta={
          <>
            <div className="font-mono tabnum">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {subs.length} subscriptions · 5-min cache
            </div>
          </>
        }
      />

      {error ? (
        <div className="bg-red-soft border border-red/30 rounded-card p-4 text-[13px] text-red">
          ⚠ Failed to load subscriptions: {error}
        </div>
      ) : (
        <StackDashboard subs={subs} />
      )}
    </main>
  );
}