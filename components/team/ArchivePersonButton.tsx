"use client";

import { useRouter } from "next/navigation";
import { DeleteControl } from "@/components/ui/DeleteControl";
import { useCanDelete } from "@/components/DeletePermission";
import { setPersonArchived } from "@/lib/mutations/person";

/**
 * People are never hard-deleted: they are payees on commission rows and
 * assignees on delivered stories. Archiving takes them off Team, out of the
 * assignee pickers and out of Cmd+K, and leaves every number intact.
 */
export function ArchivePersonButton({
  personId,
  name,
  owed,
}: {
  personId: string;
  name: string;
  owed: number;
}) {
  const router = useRouter();
  const canDelete = useCanDelete();
  if (!canDelete) return null;

  const money =
    owed > 0
      ? ` They still have ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(owed)} owed — those payments stay on the Earnings page.`
      : "";

  return (
    <DeleteControl
      variant="archive"
      label="Archive"
      question={`Archive ${name}?`}
      confirmLabel="Yes, archive"
      consequence={`They leave Team, the assignee pickers and search. Stories and payments are untouched.${money}`}
      onConfirm={() => setPersonArchived(personId, true)}
      onDone={() => router.refresh()}
    />
  );
}
