// Server Actions for Company mutations. Gated by admin/lead/editor.
"use server";

import { revalidateTag } from "next/cache";
import { patchRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireSignedIn } from "../authz";

export type CompanyPatch = {
  // New blueprint fields
  industry?: string | null;
  leadSource?: string | null;
  relationshipNotes?: string | null;
  discountPct?: number | null;
  discountReason?: string | null;
  clientStartYear?: number | null;
  // Existing fields
  website?: string | null;
  engagementFrequency?: string | null;
  contractType?: string | null;
  hourlyRate?: number | null;
  preferredBusiness?: string | null;
  hasNDA?: boolean;
  legalAddress?: string | null;
  businessDescription?: string | null;
  driveFolder?: string | null;
  miroFolder?: string | null;
  googleChat?: string | null;
};

export type MutationResult = { ok: true } | { error: string };

function buildFields(patch: CompanyPatch): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (patch.industry !== undefined) f["Industry"] = patch.industry || null;
  if (patch.leadSource !== undefined) f["Lead Source"] = patch.leadSource || null;
  if (patch.relationshipNotes !== undefined) f["Relationship Notes"] = patch.relationshipNotes ?? "";
  if (patch.discountPct !== undefined) f["Discount %"] = patch.discountPct;
  if (patch.discountReason !== undefined) f["Discount Reason"] = patch.discountReason || null;
  if (patch.clientStartYear !== undefined) f["Client Start Year"] = patch.clientStartYear;
  if (patch.website !== undefined) f["Website"] = patch.website || null;
  if (patch.engagementFrequency !== undefined) f["Engagement Frequency"] = patch.engagementFrequency || null;
  if (patch.contractType !== undefined) f["Contract Type"] = patch.contractType || null;
  if (patch.hourlyRate !== undefined) f["Hourly Rate"] = patch.hourlyRate;
  if (patch.preferredBusiness !== undefined) f["Preferred Business"] = patch.preferredBusiness || null;
  if (patch.hasNDA !== undefined) f["Has NDA?"] = patch.hasNDA;
  if (patch.legalAddress !== undefined) f["Legal Address"] = patch.legalAddress ?? "";
  if (patch.businessDescription !== undefined) f["Business Description"] = patch.businessDescription ?? "";
  if (patch.driveFolder !== undefined) f["Drive Folder"] = patch.driveFolder || null;
  if (patch.miroFolder !== undefined) f["Miro Folder"] = patch.miroFolder || null;
  if (patch.googleChat !== undefined) f["Google Chat"] = patch.googleChat || null;
  return f;
}

export async function updateCompany(
  companyId: string,
  patch: CompanyPatch,
): Promise<MutationResult> {
  if (!companyId) return { error: "Missing companyId" };

  try {
    await requireSignedIn();
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }

  if (patch.hourlyRate != null && (!Number.isFinite(patch.hourlyRate) || patch.hourlyRate < 0)) {
    return { error: "Hourly rate must be a non-negative number" };
  }
  if (patch.discountPct != null && (!Number.isFinite(patch.discountPct) || patch.discountPct < 0 || patch.discountPct > 100)) {
    return { error: "Discount % must be between 0 and 100" };
  }
  if (patch.clientStartYear != null && (!Number.isInteger(patch.clientStartYear) || patch.clientStartYear < 1900 || patch.clientStartYear > 2100)) {
    return { error: "Client start year must be a valid year" };
  }

  try {
    await patchRecords(Tables.Companies.id, [
      { id: companyId, fields: buildFields(patch) },
    ]);
    revalidateTag("airtable");
    revalidateTag("client-detail:companies");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
