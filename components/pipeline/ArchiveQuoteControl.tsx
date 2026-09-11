"use client";

import { useRouter } from "next/navigation";
import { DeleteControl } from "@/components/ui/DeleteControl";
import { useCanDelete } from "@/components/DeletePermission";
import { setQuoteArchived } from "@/lib/mutations/quote";

/**
 * Projects have no hard delete — they carry invoices, payments and a project
 * log. Archiving takes the project off the board and leaves all of it addressable.
 */
export function ArchiveQuoteControl({
  quoteId,
  projectName,
  onArchived,
}: {
  quoteId: string;
  projectName: string;
  onArchived?: () => void;
}) {
  const router = useRouter();
  const canDelete = useCanDelete();
  if (!canDelete) return null;

  return (
    <div className="px-5 py-4 border-t border-rule flex items-center justify-between gap-3 flex-wrap">
      <p className="text-[11px] text-ink-faint max-w-[46ch]">
        Archiving hides this project from the board. Stories, invoices and the project log stay
        exactly where they are.
      </p>
      <DeleteControl
        variant="archive"
        label="Archive project"
        question={`Archive "${projectName}"?`}
        confirmLabel="Yes, archive"
        consequence="It leaves the Projects board. Restore by unchecking Archived on the quote in Airtable."
        onConfirm={() => setQuoteArchived(quoteId, true)}
        onDone={() => {
          onArchived?.();
          router.refresh();
        }}
      />
    </div>
  );
}
