// Guards that stand between a delete button and an irreversible Airtable write.
//
// These exist because the base has already been damaged once this way: 150
// Team Task Payments ($41K) are stranded on records nobody can route anymore.
// A payment row points at its story; delete the story and the row is orphaned
// with no way back to what it was paying for.
import "server-only";

import { getRecord } from "./airtable";
import { Tables } from "./schema";

export type PaymentBlock = { storyId: string; name: string; payments: number };

// Typechecked against lib/schema.ts, so an Airtable rename that lands in the
// schema breaks the build instead of silently switching the guard off. The
// emoji is part of the field name (U+1F535).
const PAYMENTS_FIELD = "🔵 Team Task Payments" satisfies keyof typeof Tables.Stories.fields;

/**
 * Returns the stories that must NOT be hard-deleted because commission payment
 * rows hang off them. Empty array means the delete is safe.
 *
 * Reads one record at a time and uncached: a completion that landed inside the
 * 5-minute cache window is exactly the case this guard exists to catch.
 */
export async function storiesBlockedByPayments(
  storyIds: string[],
): Promise<PaymentBlock[]> {
  const blocked: PaymentBlock[] = [];
  for (const id of storyIds) {
    const rec = await getRecord<Record<string, unknown>>(Tables.Stories.id, id);
    const payments = rec.fields[PAYMENTS_FIELD];
    if (Array.isArray(payments) && payments.length > 0) {
      blocked.push({
        storyId: id,
        name: String(rec.fields["Story Name"] ?? "(unnamed story)"),
        payments: payments.length,
      });
    }
  }
  return blocked;
}

/** One sentence a human can act on, for the toast. */
export function paymentBlockMessage(blocked: PaymentBlock[]): string {
  const total = blocked.reduce((n, b) => n + b.payments, 0);
  const names = blocked.slice(0, 3).map((b) => b.name).join(", ");
  const more = blocked.length > 3 ? ` and ${blocked.length - 3} more` : "";
  return (
    `Can't delete: ${blocked.length} ${blocked.length === 1 ? "story has" : "stories have"} ` +
    `${total} commission payment${total === 1 ? "" : "s"} attached (${names}${more}). ` +
    `Deleting would orphan those payment rows. Archive the story instead, or clear its payments first.`
  );
}
