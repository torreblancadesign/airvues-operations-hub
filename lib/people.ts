// Resolve a signed-in email to the matching People record in Airtable.
// Email match is exact, case-insensitive, against People.Primary Email.
// PERSON_OVERRIDES env JSON (optional) lets us pin email → recId for the
// duplicate-People window (Bracho×2, Jose×2 etc — per the May 2026 audit).
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";
import type { Permission } from "./permissions";
import { ALL_PERMISSIONS } from "./permissions";

export type ResolvedPerson = {
  id: string;
  email: string;
  firstName: string;
  fullName: string;
  role: string | null;
  internalType: string | null;
  status: string | null;
  permissions: Permission[];
};

type PersonRow = {
  "Primary Email"?: string;
  "Full Name"?: string;
  "First Name"?: string;
  "Last Name"?: string;
  Role?: string;
  "Internal Type"?: string;
  Status?: string;
  Type?: string;
  Permissions?: string[];
};

function parseOverrides(): Record<string, string> {
  const raw = process.env.PERSON_OVERRIDES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => [k.toLowerCase(), v as string]),
    );
  } catch {
    return {};
  }
}

const OVERRIDES = parseOverrides();

const SHARED_MAILBOXES = new Set(["support@airvues.com", "noreply@airvues.com"]);

export async function resolvePersonByEmail(
  email: string | null | undefined,
): Promise<ResolvedPerson | null> {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (SHARED_MAILBOXES.has(lower)) return null;

  const overrideId = OVERRIDES[lower];

  // Use field NAMES (not IDs) so we can include the new "Permissions" field
  // without it being added to schema.ts yet. Keying everything consistently
  // by name removes one class of bug.
  const PEOPLE_FIELDS = [
    "Primary Email",
    "Full Name",
    "First Name",
    "Last Name",
    "Role",
    "Internal Type",
    "Status",
    "Type",
    "Permissions",
  ];

  async function fetchByEmail(searchEmail: string) {
    return listRecordsCached<PersonRow>(
      Tables.People.id,
      {
        fields: PEOPLE_FIELDS,
        filterByFormula: `LOWER({Primary Email}) = "${searchEmail}"`,
      },
      [`people:auth:v2:${searchEmail}`],
    );
  }

  let records = overrideId
    ? await listRecordsCached<PersonRow>(
        Tables.People.id,
        {
          fields: PEOPLE_FIELDS,
          filterByFormula: `RECORD_ID() = "${overrideId}"`,
        },
        [`people:auth:v2:override:${overrideId}`],
      )
    : await fetchByEmail(lower);

  // SSO email ≠ People.Primary Email fallback. Map via PERSON_EMAIL_ALIASES
  // env JSON, e.g. {"founder@gmail.com":"founder@airvues.com"}.
  if (records.length === 0 && !overrideId) {
    try {
      const aliases = JSON.parse(process.env.PERSON_EMAIL_ALIASES || "{}") as Record<string, string>;
      const aliased = aliases[lower]?.toLowerCase();
      if (aliased && aliased !== lower) {
        records = await fetchByEmail(aliased);
      }
    } catch {
      // ignore malformed alias env
    }
  }

  const DEBUG = process.env.DEBUG_PERMISSIONS === "true";
  if (DEBUG) {
    console.log("[permissions] resolve", {
      email: lower,
      overrideId: overrideId ?? null,
      matched: records.length,
      firstFieldKeys: records[0] ? Object.keys(records[0].fields) : null,
    });
  }

  if (records.length === 0) return null;

  // Canonical record tiebreakers: 1) Active, 2) Internal, 3) earliest created.
  const ranked = [...records].sort((a, b) => {
    const sa = a.fields.Status === "Active" ? 0 : 1;
    const sb = b.fields.Status === "Active" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const ta = a.fields.Type;
    const tb = b.fields.Type;
    const ia = ta === "Internal" || ta === "Internal team member" ? 0 : 1;
    const ib = tb === "Internal" || tb === "Internal team member" ? 0 : 1;
    if (ia !== ib) return ia - ib;
    return a.createdTime.localeCompare(b.createdTime);
  });

  const winner = ranked[0];
  const f = winner.fields as Record<string, unknown>;
  const fullName =
    (f["Full Name"] as string) ||
    [f["First Name"], f["Last Name"]].filter(Boolean).join(" ").trim() ||
    lower;
  const firstName = (f["First Name"] as string) || fullName.split(/\s+/)[0] || lower;

  // Defensive: find the Permissions value by case/whitespace-insensitive key
  // scan, in case the Airtable field name has a stray emoji or trailing space.
  const permsEntry = Object.entries(f).find(
    ([k]) => k.trim().toLowerCase() === "permissions",
  );
  const rawPermsValue = permsEntry?.[1];
  const rawPerms = Array.isArray(rawPermsValue) ? rawPermsValue : [];
  const permissions = rawPerms.filter((p): p is Permission =>
    typeof p === "string" && (ALL_PERMISSIONS as string[]).includes(p),
  );

  if (DEBUG) {
    console.log("[permissions] resolved", {
      email: lower,
      winnerId: winner.id,
      winnerEmail: f["Primary Email"],
      rawPerms,
      permissions,
    });
  }

  return {
    id: winner.id,
    email: lower,
    firstName,
    fullName,
    role: (f["Role"] as string) ?? null,
    internalType: (f["Internal Type"] as string) ?? null,
    status: (f["Status"] as string) ?? null,
    permissions,
  };
}
