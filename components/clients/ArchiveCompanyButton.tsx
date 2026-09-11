"use client";

import { useRouter } from "next/navigation";
import { DeleteControl } from "@/components/ui/DeleteControl";
import { useCanDelete } from "@/components/DeletePermission";
import { setCompanyArchived } from "@/lib/mutations/company";

/**
 * Accounts are never hard-deleted: a company is the tenant key for quotes,
 * retainers, portal access and attributed revenue. Archiving takes it off the
 * Accounts board, out of the pickers and out of Cmd+K.
 */
export function ArchiveCompanyButton({
  companyId,
  name,
  lifetimeRevenue,
  onArchived,
}: {
  companyId: string;
  name: string;
  lifetimeRevenue: number;
  onArchived?: () => void;
}) {
  const router = useRouter();
  const canDelete = useCanDelete();
  if (!canDelete) return null;

  const money =
    lifetimeRevenue > 0
      ? ` ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(lifetimeRevenue)} of attributed revenue stays counted.`
      : "";

  return (
    <DeleteControl
      variant="archive"
      label="Archive account"
      question={`Archive ${name}?`}
      confirmLabel="Yes, archive"
      consequence={`It leaves Accounts, the company pickers and search. Quotes, invoices and retainers are untouched.${money} Their client portal keeps working.`}
      onConfirm={() => setCompanyArchived(companyId, true)}
      onDone={() => {
        onArchived?.();
        router.refresh();
      }}
    />
  );
}
