// Server Actions for the People (Clients/Accounts) table.
// Currently exposes status mutations for the unified Accounts model:
//   - Partner Status: Lead | Client
//   - Lead Status: New Lead | Discovery | Proposal Drafting | Proposal Sent | Won | Lost | On Hold
"use server";

import { revalidateTag } from "next/cache";
import { patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import { logEventInternal } from "./project-log";

export type ClientMutationResult = { ok: true } | { error: string };

const PARTNER_STATUS_CHOICES = ["Lead", "Client"] as const;
const LEAD_STATUS_CHOICES = [
  "New Lead",
  "Discovery",
  "Proposal Drafting",
  "Proposal Sent",
  "Won",
  "Lost",
  "On Hold",
] as const;

export type PartnerStatus = (typeof PARTNER_STATUS_CHOICES)[number];
export type LeadStatus = (typeof LEAD_STATUS_CHOICES)[number];

async function gate(): Promise<ClientMutationResult | null> {
  try {
    await requireRole("admin", "lead", "editor");
    return null;
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
}

export async function updateClientStatuses(args: {
  clientId: string;
  partnerStatus?: PartnerStatus | null;
  leadStatus?: LeadStatus | null;
}): Promise<ClientMutationResult> {
  const { clientId, partnerStatus, leadStatus } = args;
  if (!clientId || !clientId.startsWith("rec")) return { error: "Invalid clientId" };

  if (
    partnerStatus !== undefined &&
    partnerStatus !== null &&
    !(PARTNER_STATUS_CHOICES as readonly string[]).includes(partnerStatus)
  ) {
    return { error: "Invalid Partner Status" };
  }
  if (
    leadStatus !== undefined &&
    leadStatus !== null &&
    !(LEAD_STATUS_CHOICES as readonly string[]).includes(leadStatus)
  ) {
    return { error: "Invalid Lead Status" };
  }

  const denied = await gate();
  if (denied) return denied;

  const fields: Record<string, unknown> = {};
  if (partnerStatus !== undefined) fields["Partner Status"] = partnerStatus;
  if (leadStatus !== undefined) fields["Lead Status"] = leadStatus;

  if (Object.keys(fields).length === 0) return { ok: true };

  try {
    await patchRecords(Tables.People.id, [{ id: clientId, fields }]);
    revalidateTag("airtable");
    revalidateTag("accounts:all");
    revalidateTag("clients:people");

    if (partnerStatus) {
      await logEventInternal({
        accountId: clientId,
        eventType: "Partner status changed",
        detail: `Partner Status set to ${partnerStatus}`,
      });
    }
    if (leadStatus) {
      await logEventInternal({
        accountId: clientId,
        eventType: leadStatus === "Won" ? "Proposal signed" : "Discovery notes added",
        detail: `Lead Status set to ${leadStatus}`,
      });
    }
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
