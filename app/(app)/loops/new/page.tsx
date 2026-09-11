// New recording page — title input + client/quote pickers + recorder.
import { PageHeader } from "@/components/ui/PageHeader";
import { NewLoopForm } from "@/components/loops/NewLoopForm";
import { listAllClients } from "@/lib/clients";
import { listQuoteOptions } from "@/lib/quotes-light";

export const revalidate = 60;
// Loop analysis (audio extraction + Gemini) runs via waitUntil from createLoop.
// Give the underlying lambda enough headroom for ~20-min recordings.
export const maxDuration = 300;

export default async function NewLoopPage() {
  const [clientRows, quoteOpts] = await Promise.all([
    listAllClients().catch(() => []),
    listQuoteOptions().catch(() => []),
  ]);

  const clients = clientRows
    .map((c) => ({ id: c.id, label: c.name || "(unnamed)" }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const quotes = quoteOpts.map((q) => ({ id: q.id, label: q.label }));

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="New Loop"
        subtitle="Record your screen + mic. Optional face bubble, tag to a client or quote."
      />
      <NewLoopForm
        clients={clients}
        quotes={quotes}
      />
    </main>
  );
}
