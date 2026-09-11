// One-shot: adds "Portal History" to ⚙️ People.
// Idempotent — skips if it already exists. Safe to re-run.
// Run: set -a; . ./.env.local; set +a; node scripts/add-portal-history-field.mjs
const BASE = "app4vhhWMbRFOloOU";
const PEOPLE = "tbl9wvZY9M7Y7hcf1";
const TOKEN = process.env.AIRTABLE_TOKEN;

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN must be set. Run with: set -a; . ./.env.local; set +a");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const meta = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, { headers });
if (!meta.ok) throw new Error(`Meta read failed (${meta.status}): ${await meta.text()}`);
const { tables } = await meta.json();
const people = tables.find((t) => t.id === PEOPLE);
if (!people) throw new Error(`Table ${PEOPLE} not found`);

if (people.fields.some((f) => f.name === "Portal History")) {
  console.log("skip Portal History (exists)");
} else {
  const r = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables/${PEOPLE}/fields`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Portal History",
      type: "multilineText",
      description:
        "Append-only log of portal access changes and client attachment: granted, revoked, linked to a company, detached and why. Written by the ops app; never edit by hand.",
    }),
  });
  if (!r.ok) throw new Error(`Create failed (${r.status}): ${await r.text()}`);
  const f = await r.json();
  console.log(`created ${f.name} -> ${f.id}`);
}
console.log("done");
