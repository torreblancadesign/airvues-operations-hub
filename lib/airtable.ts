// Server-only Airtable client. Do NOT import from client components — token must never ship to browser.
// Field IDs are referenced via `lib/schema.ts`, not field names. Field renames in Airtable don't break the dashboard.
import "server-only";

import { unstable_cache } from "next/cache";

const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;

if (typeof window !== "undefined") {
  throw new Error("lib/airtable.ts imported on the client. This is a token-leak vector. Move the import.");
}

export type AirtableRecord<F = Record<string, unknown>> = {
  id: string;
  createdTime: string;
  fields: F;
};

type ListOpts = {
  view?: string;
  maxRecords?: number;
  filterByFormula?: string;
  fields?: string[]; // Field IDs to return (reduces payload)
  sort?: { field: string; direction?: "asc" | "desc" }[];
  returnFieldsByFieldId?: boolean;
};

function assertEnv() {
  if (!BASE_ID || !TOKEN) {
    throw new Error(
      "Airtable env not set. Configure AIRTABLE_TOKEN and AIRTABLE_BASE_ID in .env.local or Vercel.",
    );
  }
}

/**
 * Low-level paginated fetch. Returns ALL records matching opts (paginates internally).
 * Server-only. Subject to Airtable's 5 req/sec rate limit; pages internally with light delay.
 */
export async function listRecords<F = Record<string, unknown>>(
  tableIdOrName: string,
  opts: ListOpts = {},
): Promise<AirtableRecord<F>[]> {
  assertEnv();

  const baseParams = new URLSearchParams();
  if (opts.view) baseParams.set("view", opts.view);
  if (opts.maxRecords) baseParams.set("maxRecords", String(opts.maxRecords));
  if (opts.filterByFormula) baseParams.set("filterByFormula", opts.filterByFormula);
  if (opts.returnFieldsByFieldId) baseParams.set("returnFieldsByFieldId", "true");
  if (opts.fields) {
    opts.fields.forEach((f) => baseParams.append("fields[]", f));
  }
  if (opts.sort) {
    opts.sort.forEach((s, i) => {
      baseParams.set(`sort[${i}][field]`, s.field);
      if (s.direction) baseParams.set(`sort[${i}][direction]`, s.direction);
    });
  }

  const records: AirtableRecord<F>[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams(baseParams);
    if (offset) params.set("offset", offset);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableIdOrName)}?${params.toString()}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      // Avoid Next's edge cache here — we wrap higher-level reads in unstable_cache instead
      cache: "no-store",
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Airtable list ${tableIdOrName} failed (${resp.status}): ${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as { records: AirtableRecord<F>[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
    if (offset) await new Promise((r) => setTimeout(r, 220)); // 5 req/sec rate guard
  } while (offset);

  return records;
}

/**
 * Cached read. Wraps listRecords in Next's unstable_cache with a 5-minute revalidate window.
 * Use this for KPIs and dashboard reads. Cache key includes opts so different filters cache separately.
 */
export function listRecordsCached<F = Record<string, unknown>>(
  tableIdOrName: string,
  opts: ListOpts = {},
  cacheTags: string[] = [],
): Promise<AirtableRecord<F>[]> {
  const key = `airtable:list:${tableIdOrName}:${JSON.stringify(opts)}`;
  const fn = unstable_cache(
    async () => listRecords<F>(tableIdOrName, opts),
    [key],
    { revalidate: 300, tags: ["airtable", `airtable:${tableIdOrName}`, ...cacheTags] },
  );
  return fn();
}

// ---------- Mutations ----------

type Patch = { id: string; fields: Record<string, unknown> };

export async function getRecord<F = Record<string, unknown>>(
  tableIdOrName: string,
  recordId: string,
): Promise<AirtableRecord<F>> {
  assertEnv();
  const resp = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Airtable GET ${tableIdOrName}/${recordId} failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  return (await resp.json()) as AirtableRecord<F>;
}

export async function patchRecords<F = Record<string, unknown>>(
  tableIdOrName: string,
  patches: Patch[],
): Promise<AirtableRecord<F>[]> {
  assertEnv();
  if (patches.length === 0) return [];
  const out: AirtableRecord<F>[] = [];
  for (let i = 0; i < patches.length; i += 10) {
    const chunk = patches.slice(i, i + 10);
    const resp = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: chunk, typecast: true }),
      },
    );
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Airtable PATCH ${tableIdOrName} failed (${resp.status}): ${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as { records: AirtableRecord<F>[] };
    out.push(...data.records);
    if (i + 10 < patches.length) await new Promise((r) => setTimeout(r, 220));
  }
  return out;
}

export async function deleteRecord(
  tableIdOrName: string,
  recordId: string,
): Promise<void> {
  assertEnv();
  const resp = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Airtable DELETE ${tableIdOrName}/${recordId} failed (${resp.status}): ${body.slice(0, 300)}`);
  }
}

export async function createRecords<F = Record<string, unknown>>(
  tableIdOrName: string,
  records: { fields: Record<string, unknown> }[],
): Promise<AirtableRecord<F>[]> {
  assertEnv();
  const out: AirtableRecord<F>[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const resp = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableIdOrName)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ records: chunk, typecast: true }),
      },
    );
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Airtable CREATE ${tableIdOrName} failed (${resp.status}): ${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as { records: AirtableRecord<F>[] };
    out.push(...data.records);
    if (i + 10 < records.length) await new Promise((r) => setTimeout(r, 220));
  }
  return out;
}
