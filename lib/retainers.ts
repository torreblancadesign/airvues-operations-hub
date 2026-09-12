// Server-only Airtable reads for retainer agreements and their tiers.
// Do NOT import from a client component — this pulls in lib/airtable.ts.
import "server-only";

import { getRecord, listRecords, listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { currentPeriod } from "./retainer-period";
import type { RetainerAgreement, RetainerPriority, RetainerTier } from "./retainer-types";

// Re-exported so existing importers keep working after the pure-module split.
export { currentPeriod };
export type { RetainerAgreement };

const TIER = Tables.RetainerTiers;
const QUOTE = Tables.Quotes;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function firstLink(v: unknown): string | null {
  return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
}

/**
 * All tiers, active and inactive, catalog and custom, ordered by rank.
 * Blank SLA columns stay null — not zero.
 *
 * `fresh: true` bypasses the 5-minute cache. MUTATIONS MUST PASS IT. `SLA Due
 * At` is computed once at creation and never recalculated, so a request filed
 * while a stale tier says "no SLA" keeps a null deadline permanently and is
 * reported "Not covered" forever. Reads for display can stay cached.
 */
export async function listRetainerTiers(opts?: { fresh?: boolean }): Promise<RetainerTier[]> {
  const read = opts?.fresh ? listRecords : listRecordsCached;
  const rows = await read<Record<string, unknown>>(
    TIER.id,
    {
      fields: [
        TIER.fields["Tier Name"].id,
        TIER.fields["Rank"].id,
        TIER.fields["Active"].id,
        TIER.fields["Included Hours"].id,
        TIER.fields["Monthly Rate"].id,
        TIER.fields["SLA — Urgent (business hrs)"].id,
        TIER.fields["SLA — High (business hrs)"].id,
        TIER.fields["SLA — Medium (business hrs)"].id,
        TIER.fields["SLA — Low (business hrs)"].id,
        TIER.fields["SLA Label (client-facing)"].id,
        TIER.fields["Max Urgent / Month"].id,
        TIER.fields["Client-facing Description"].id,
        TIER.fields["Custom"].id,
        TIER.fields["Custom For"].id,
      ],
    },
    opts?.fresh ? undefined : ["retainers:tiers"],
  );

  const tiers: RetainerTier[] = rows.map((r) => {
    const f = r.fields;
    const slaHours: Record<RetainerPriority, number | null> = {
      Urgent: num(f["SLA — Urgent (business hrs)"]),
      High: num(f["SLA — High (business hrs)"]),
      Medium: num(f["SLA — Medium (business hrs)"]),
      Low: num(f["SLA — Low (business hrs)"]),
    };
    return {
      id: r.id,
      name: str(f["Tier Name"]) ?? "(unnamed)",
      rank: num(f["Rank"]) ?? 999,
      active: f["Active"] === true,
      custom: f["Custom"] === true,
      customForCompanyId: firstLink(f["Custom For"]),
      includedHours: num(f["Included Hours"]),
      monthlyRate: num(f["Monthly Rate"]),
      slaHours,
      slaLabel: str(f["SLA Label (client-facing)"]),
      maxUrgentPerMonth: num(f["Max Urgent / Month"]),
      clientDescription: str(f["Client-facing Description"]),
    };
  });

  // Inactive plans are returned deliberately. The board resolves tier names
  // from this list, and tierForRetainer resolves SLA hours from it — filtering
  // here would blank the name on every retainer using a retired plan and drop
  // its live requests to "Not covered". Picker scoping is plansAvailableFor's job.
  return tiers.sort((a, b) => a.rank - b.rank);
}

/**
 * Retainer Agreement quotes. Only rows carrying a Company link are returned —
 * Company is the portal tenant key and an agreement without one is
 * unscopable, so it is invisible by design rather than leaked to everyone.
 */
/** recId -> Company.Name, for resolving the tenant key to a display name. */
async function companyNameById(): Promise<Map<string, string>> {
  const rows = await listRecordsCached<Record<string, unknown>>(
    Tables.Companies.id,
    { fields: [Tables.Companies.fields["Name"].id] },
    ["retainers:company-names"],
  );
  return new Map(
    rows.flatMap((r) => {
      const n = str(r.fields["Name"]);
      return n ? ([[r.id, n]] as [string, string][]) : [];
    }),
  );
}

export async function listRetainerAgreements(opts?: {
  fresh?: boolean;
}): Promise<RetainerAgreement[]> {
  const readAgreements = opts?.fresh ? listRecords : listRecordsCached;
  const [rows, companyNames] = await Promise.all([
    readAgreements<Record<string, unknown>>(
    QUOTE.id,
    {
      fields: [
        QUOTE.fields["Project Name"].id,
        QUOTE.fields["Company"].id,
        QUOTE.fields["Client Name"].id,
        QUOTE.fields["Retainer Tier"].id,
        QUOTE.fields["Retainer Selected Monthly Rate"].id,
        QUOTE.fields["Retainer Selected Hours"].id,
        QUOTE.fields["Retainer Initial Term Months"].id,
        QUOTE.fields["Retainer Effective Date"].id,
        QUOTE.fields["Retainer Subscription Active"].id,
        QUOTE.fields["Retainer Archived"].id,
        QUOTE.fields["Status"].id,
      ],
      filterByFormula: `{Proposal Type} = 'Retainer Agreement'`,
    },
      opts?.fresh ? undefined : ["retainers:agreements"],
    ),
    companyNameById(),
  ]);

  return rows
    .map((r) => {
      const f = r.fields;
      // Quotes."Client Name" is a lookup of the CONTACT, not the company —
      // it renders as "Flavio Almeida", not "Gracie Barra". Resolve the real
      // company through the Company link (the tenant key) and keep the
      // contact name separately.
      const contacts = f["Client Name"];
      const companyId = firstLink(f["Company"]);
      return {
        id: r.id,
        projectName: str(f["Project Name"]) ?? "(no name)",
        companyId,
        companyName: companyId ? (companyNames.get(companyId) ?? null) : null,
        contactName:
          Array.isArray(contacts) && typeof contacts[0] === "string" ? contacts[0] : null,
        tierId: firstLink(f["Retainer Tier"]),
        monthlyRate: num(f["Retainer Selected Monthly Rate"]),
        includedHours: num(f["Retainer Selected Hours"]),
        termMonths: num(f["Retainer Initial Term Months"]),
        effectiveDate: str(f["Retainer Effective Date"]),
        subscriptionActive: f["Retainer Subscription Active"] === "Active",
        archived: f["Retainer Archived"] === true,
        dealStatus: str(f["Status"]),
      };
    })
    .filter((a) => a.companyId !== null);
}

/**
 * The quote's legacy "Retainer Selected Tier" singleSelect, or null.
 *
 * Read separately from listRetainerAgreements because it exists only to be
 * shown when it disagrees with the linked plan. Custom plans have no legacy
 * equivalent, so writes leave it alone rather than blanking it, and the detail
 * page surfaces the drift instead of hiding it.
 */
export async function legacySelectedTierFor(quoteId: string): Promise<string | null> {
  try {
    const rec = await getRecord<Record<string, unknown>>(QUOTE.id, quoteId);
    return str(rec.fields["Retainer Selected Tier"]);
  } catch {
    return null;
  }
}
