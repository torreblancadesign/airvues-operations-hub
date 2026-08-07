// Server-only Airtable reads for retainer agreements and their tiers.
// Do NOT import from a client component — this pulls in lib/airtable.ts.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import { fromZoned, zonedParts } from "./retainer-sla";
import type { RetainerPriority, RetainerTier } from "./retainer-types";

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

/** Active tiers, ordered by rank. Blank SLA columns stay null — not zero. */
export async function listRetainerTiers(): Promise<RetainerTier[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
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
      ],
    },
    ["retainers:tiers"],
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
      includedHours: num(f["Included Hours"]),
      monthlyRate: num(f["Monthly Rate"]),
      slaHours,
      slaLabel: str(f["SLA Label (client-facing)"]),
      maxUrgentPerMonth: num(f["Max Urgent / Month"]),
      clientDescription: str(f["Client-facing Description"]),
    };
  });

  return tiers.filter((t) => t.active).sort((a, b) => a.rank - b.rank);
}

export type RetainerAgreement = {
  id: string;
  projectName: string;
  companyId: string | null;
  companyName: string | null;
  tierId: string | null;
  monthlyRate: number | null;
  includedHours: number | null;
  termMonths: number | null;
  effectiveDate: string | null;
  subscriptionActive: boolean;
  dealStatus: string | null;
};

/**
 * Retainer Agreement quotes. Only rows carrying a Company link are returned —
 * Company is the portal tenant key and an agreement without one is
 * unscopable, so it is invisible by design rather than leaked to everyone.
 */
export async function listRetainerAgreements(): Promise<RetainerAgreement[]> {
  const rows = await listRecordsCached<Record<string, unknown>>(
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
        QUOTE.fields["Status"].id,
      ],
      filterByFormula: `{Proposal Type} = 'Retainer Agreement'`,
    },
    ["retainers:agreements"],
  );

  return rows
    .map((r) => {
      const f = r.fields;
      const names = f["Client Name"];
      return {
        id: r.id,
        projectName: str(f["Project Name"]) ?? "(no name)",
        companyId: firstLink(f["Company"]),
        companyName: Array.isArray(names) && typeof names[0] === "string" ? names[0] : null,
        tierId: firstLink(f["Retainer Tier"]),
        monthlyRate: num(f["Retainer Selected Monthly Rate"]),
        includedHours: num(f["Retainer Selected Hours"]),
        termMonths: num(f["Retainer Initial Term Months"]),
        effectiveDate: str(f["Retainer Effective Date"]),
        subscriptionActive: f["Retainer Subscription Active"] === "Active",
        dealStatus: str(f["Status"]),
      };
    })
    .filter((a) => a.companyId !== null);
}

/**
 * The billing period containing `now`, anchored on the anniversary day of
 * effectiveDate (NOT the calendar month) so hours stay aligned with the Stripe
 * subscription date. A day-of-month past the end of a short month clamps to
 * that month's last day.
 */
export function currentPeriod(
  effectiveDate: string | null,
  now: Date,
): { start: Date; end: Date } | null {
  if (!effectiveDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate);
  if (!m) return null;
  const anchorDay = +m[3];

  const p = zonedParts(now);
  const daysInMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const startOf = (y: number, mo: number) =>
    fromZoned(y, mo, Math.min(anchorDay, daysInMonth(y, mo)), 0, 0);

  let sy = p.year;
  let sm = p.month;
  if (now < startOf(sy, sm)) {
    sm -= 1;
    if (sm === 0) {
      sm = 12;
      sy -= 1;
    }
  }
  let ey = sy;
  let em = sm + 1;
  if (em === 13) {
    em = 1;
    ey += 1;
  }
  return { start: startOf(sy, sm), end: startOf(ey, em) };
}
