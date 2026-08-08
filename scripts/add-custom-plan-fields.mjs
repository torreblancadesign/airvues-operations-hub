// One-shot: adds Custom + Custom For to ⚙️ Retainer Tiers.
// Idempotent — skips a field that already exists. Safe to re-run.
// Run: set -a; . ./.env.local; set +a; node scripts/add-custom-plan-fields.mjs
const BASE = "app4vhhWMbRFOloOU";
const TIERS = "tblT6U9M9EFa4lKu0";
const COMPANIES = "tblQ3hxcIEUQPLN6f";
const TOKEN = process.env.AIRTABLE_TOKEN;

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN must be set. Run with: set -a; . ./.env.local; set +a");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function existingFieldNames() {
  const r = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, { headers });
  if (!r.ok) throw new Error(`Meta read failed (${r.status}): ${await r.text()}`);
  const { tables } = await r.json();
  const t = tables.find((x) => x.id === TIERS);
  if (!t) throw new Error(`Table ${TIERS} not found`);
  return new Set(t.fields.map((f) => f.name));
}

async function createField(body) {
  const r = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE}/tables/${TIERS}/fields`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  if (!r.ok) throw new Error(`Create ${body.name} failed (${r.status}): ${await r.text()}`);
  const f = await r.json();
  console.log(`created ${f.name} -> ${f.id}`);
}

const have = await existingFieldNames();

if (have.has("Custom")) {
  console.log("skip Custom (exists)");
} else {
  await createField({
    name: "Custom",
    type: "checkbox",
    description: "Checked = a negotiated plan for one client. Hidden from the general catalog.",
    options: { icon: "check", color: "purpleBright" },
  });
}

if (have.has("Custom For")) {
  console.log("skip Custom For (exists)");
} else {
  await createField({
    name: "Custom For",
    type: "multipleRecordLinks",
    description: "The single client this custom plan belongs to. Required when Custom is checked.",
    // linkedTableId ONLY. The create schema for a link field is narrower than
    // the read schema: isReversed / prefersSingleRecordLink come back on a GET
    // but are rejected on POST. Single-link is a UI preference anyway — the
    // reader takes the first link regardless (firstLink in lib/retainers.ts).
    options: { linkedTableId: COMPANIES },
  });
}

console.log("done");
