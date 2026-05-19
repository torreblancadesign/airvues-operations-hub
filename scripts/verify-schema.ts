// CI guard — verifies that lib/schema.ts matches the live Airtable Meta API.
// Wired as `npm run verify-schema`; should also run as a `prebuild` step before `next build`.
// Exits non-zero on drift. Field-renames in Airtable do NOT break the dashboard (we use IDs),
// but missing/type-changed fields DO — this catches them before deploy.

import { Tables } from "../lib/schema";

const BASE_ID = process.env.AIRTABLE_BASE_ID || "app4vhhWMbRFOloOU";
const TOKEN = process.env.AIRTABLE_TOKEN;

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN must be set in env to run verify-schema.");
  process.exit(1);
}

type LiveTable = {
  id: string;
  name: string;
  fields: { id: string; name: string; type: string }[];
};

async function main() {
  const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!resp.ok) {
    console.error(`Meta API failed: ${resp.status}`);
    process.exit(1);
  }
  const { tables } = (await resp.json()) as { tables: LiveTable[] };
  const liveById = new Map(tables.map((t) => [t.id, t]));

  let errors = 0;

  for (const [tableKey, tableDef] of Object.entries(Tables)) {
    const live = liveById.get(tableDef.id);
    if (!live) {
      console.error(`❌ Table ${tableKey} (${tableDef.id}) not found in live base`);
      errors++;
      continue;
    }
    const liveFieldsById = new Map(live.fields.map((f) => [f.id, f]));
    for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
      const liveField = liveFieldsById.get(fieldDef.id);
      if (!liveField) {
        console.error(`❌ ${tableKey}.${fieldName} (${fieldDef.id}) not found on live table`);
        errors++;
        continue;
      }
      if (liveField.type !== fieldDef.type) {
        console.error(`❌ ${tableKey}.${fieldName} type mismatch — schema.ts: ${fieldDef.type}, live: ${liveField.type}`);
        errors++;
      }
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} error(s). Run from a repo root with AIRTABLE_TOKEN set.`);
    process.exit(1);
  }
  console.log("✅ Schema OK — all referenced field IDs and types match live base.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
