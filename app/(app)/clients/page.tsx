import { listAllClients } from "@/lib/clients";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientsDashboard } from "@/components/clients/ClientsDashboard";
import { assertCanAccess } from "@/lib/page-guard";

export default async function ClientsPage() {
  await assertCanAccess("/clients");
  let clients: Awaited<ReturnType<typeof listAllClients>> = [];
  let error: string | null = null;
  try {
    clients = await listAllClients();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="Clients"
        subtitle="All companies · engagement, lifetime revenue, at-risk. Click any row to drill in."
        meta={
          <>
            <div className="font-mono tabnum">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[11px] text-ink-faint mt-0.5">
              {clients.length.toLocaleString()} companies loaded · 5-min cache
            </div>
          </>
        }
      />

      {error ? (
        <div className="bg-red-soft border border-red/30 rounded-card p-4 text-[13px] text-red">
          ⚠ Failed to load clients: {error}
        </div>
      ) : (
        <ClientsDashboard clients={clients} />
      )}
    </main>
  );
}