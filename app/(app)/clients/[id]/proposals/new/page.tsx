// In-context proposal creation. Hitting this URL creates a Draft quote linked
// to the company's primary contact, then redirects into the full-page editor.
import { redirect } from "next/navigation";
import { getClientDetail } from "@/lib/client-detail";
import { createDraftQuote } from "@/lib/mutations/quote";
import { assertCanAccess } from "@/lib/page-guard";

export default async function NewClientProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertCanAccess("/clients");
  const { id } = await params;

  const detail = await getClientDetail(id);
  const projectName = `${detail.name} — new proposal`;

  const result = await createDraftQuote({
    preparedForId: detail.primaryContactId,
    projectName,
  });

  if ("error" in result) {
    return (
      <main className="max-w-[800px] mx-auto px-6 py-12">
        <h1 className="text-[18px] font-semibold text-ink-strong mb-2">
          Could not create proposal
        </h1>
        <p className="text-[13px] text-red mb-4">{result.error}</p>
        <a href={`/clients/${id}`} className="text-[13px] text-emerald hover:underline">
          ← Back to client
        </a>
      </main>
    );
  }

  redirect(`/pipeline/${result.quoteId}?fromClient=${id}`);
}
