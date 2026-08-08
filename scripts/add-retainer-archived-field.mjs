// One-shot: adds "Retainer Archived" to ⚪️ Quotes.
// Idempotent — skips if it already exists. Safe to re-run.
// Run: set -a; . ./.env.local; set +a; node scripts/add-retainer-archived-field.mjs
const BASE = "app4vhhWMbRFOloOU";
const QUOTES = "tbldBIfAeRAunipbk";
const TOKEN = process.env.AIRTABLE_TOKEN;

if (!TOKEN) {
  console.error("AIRTABLE_TOKEN must be set. Run with: set -a; . ./.env.local; set +a");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const meta = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, { headers });
if (!meta.ok) throw new Error(`Meta read failed (${meta.status}): ${await meta.text()}`);
const { tables } = await meta.json();
const quotes = tables.find((t) => t.id === QUOTES);
if (!quotes) throw new Error(`Table ${QUOTES} not found`);

if (quotes.fields.some((f) => f.name === "Retainer Archived")) {
  console.log("skip Retainer Archived (exists)");
} else {
  const r = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE}/tables/${QUOTES}/fields`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Retainer Archived",
        type: "checkbox",
        description:
          "Hidden from the retainers board. Nothing is deleted — requests, comments and stories stay linked. Distinct from Retainer Subscription Active, which is the subscription state.",
        options: { icon: "check", color: "grayBright" },
      }),
    },
  );
  if (!r.ok) throw new Error(`Create failed (${r.status}): ${await r.text()}`);
  const f = await r.json();
  console.log(`created ${f.name} -> ${f.id}`);
}

console.log("done");
