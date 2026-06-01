// New recording page — title input + client/quote pickers + recorder.
import { PageHeader } from "@/components/ui/PageHeader";
import { NewLoopForm } from "@/components/loops/NewLoopForm";
import { listAllClients } from "@/lib/clients";
import { listQuoteOptions } from "@/lib/quotes-light";
import { getAppSession } from "@/lib/session";
import { resolvePersonByEmail } from "@/lib/people";

export const revalidate = 60;

export default async function NewLoopPage() {
  const [clientRows, quoteOpts, session] = await Promise.all([
    listAllClients().catch(() => []),
    listQuoteOptions().catch(() => []),
    getAppSession(),
  ]);

  const clients = clientRows
    .map((c) => ({ id: c.id, label: c.name || "(unnamed)" }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const quotes = quoteOpts.map((q) => ({ id: q.id, label: q.label }));

  const me = await resolvePersonByEmail(session?.user?.email).catch(() => null);
  const ownerFirstName = me?.firstName ?? null;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="New Loop"
        subtitle="Record your screen + mic. Optional face bubble, tag to a client or quote."
      />
      <NewLoopForm
        clients={clients}
        quotes={quotes}
        ownerFirstName={ownerFirstName}
      />
    </main>
  );
}
