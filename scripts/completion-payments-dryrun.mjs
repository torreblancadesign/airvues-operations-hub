// Dry-run for completion payments. NEVER writes. Usage:
//   node scripts/completion-payments-dryrun.mjs recStoryId   → plan for one story
//   node scripts/completion-payments-dryrun.mjs --scan       → list multi-assignee stories
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const TOKEN = env.AIRTABLE_TOKEN;
const BASE = env.AIRTABLE_BASE_ID || "app4vhhWMbRFOloOU";
const H = { Authorization: `Bearer ${TOKEN}` };
const api = (path) =>
  fetch(`https://api.airtable.com/v0/${BASE}/${path}`, { headers: H }).then((r) => r.json());
const listAll = async (table, params = "") => {
  let records = [];
  let offset;
  do {
    const page = await api(`${table}?${params}${offset ? `&offset=${offset}` : ""}`);
    records = records.concat(page.records ?? []);
    offset = page.offset;
    if (offset) await new Promise((r) => setTimeout(r, 220));
  } while (offset);
  return records;
};
const round2 = (n) => Math.round(n * 100) / 100;
const RATE_DEFAULT = 0.15;

const STORIES = "tblgd7iKw2KdPBkn2";
const PEOPLE = "tbl9wvZY9M7Y7hcf1";
const PAYMENTS = "tblvzdxVq7drJtobt";
const EXPENSES = "tblhQ9jkgVAuG97gg";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/completion-payments-dryrun.mjs <recStoryId> | --scan");
  process.exit(1);
}

if (arg === "--scan") {
  const fields = ["Story Name", "Assignee", "Story Status", "Cost"]
    .map((f) => `fields%5B%5D=${encodeURIComponent(f)}`)
    .join("&");
  const stories = await listAll(STORIES, fields);
  let n = 0;
  for (const s of stories) {
    const a = s.fields.Assignee ?? [];
    if (a.length > 1) {
      n++;
      console.log(
        `${s.id}  [${s.fields["Story Status"] ?? "?"}]  $${s.fields.Cost ?? 0}  ${a.length} assignees  ${s.fields["Story Name"] ?? "(untitled)"}`,
      );
    }
  }
  console.log(`\n${n} multi-assignee stories of ${stories.length} total.`);
  process.exit(0);
}

const story = await api(`${STORIES}/${arg}`);
if (story.error) {
  console.error("Story fetch failed:", JSON.stringify(story.error));
  process.exit(1);
}
const f = story.fields;
console.log(`Story: ${f["Story Name"]}  status=${f["Story Status"]}  cost=$${f.Cost ?? 0}`);
const assignees = f.Assignee ?? [];
if (assignees.length === 0) console.log("  (no assignees — nothing would be created)");
if (!(f.Cost > 0)) console.log("  (Cost is 0 — nothing would be created)");

const existing = f["🔵 Team Task Payments"] ?? [];
const coveredPeople = new Set();
const coveredEmails = new Set();
for (const id of existing) {
  const p = await api(`${PAYMENTS}/${id}`);
  for (const a of p.fields["Internal Team Member Account (from Link to Expenses)"] ?? []) {
    coveredPeople.add(a);
  }
  if (p.fields.Payee?.email) coveredEmails.add(p.fields.Payee.email.toLowerCase());
  console.log(
    `  existing payment ${id}: $${p.fields.Amount} → ${p.fields.Payee?.name ?? "?"} [${p.fields.Status}]`,
  );
}

const expenseFields = ["Expense Name", "Internal Team Member Account", "Status"]
  .map((x) => `fields%5B%5D=${encodeURIComponent(x)}`)
  .join("&");
const expenses = await listAll(EXPENSES, expenseFields);

for (const pid of assignees) {
  const person = await api(`${PEOPLE}/${pid}`);
  const pf = person.fields ?? {};
  const name = pf["Full Name"] ?? pid;
  const raw = pf["Commission Percentage"];
  const pct = typeof raw === "number" ? (raw > 1 ? raw / 100 : raw) : RATE_DEFAULT;
  const email = (pf["Airtable Account"] ?? pf["User"] ?? [])[0]?.email?.toLowerCase() ?? null;
  const dup = coveredPeople.has(pid) || (email && coveredEmails.has(email));
  const batch = expenses.find(
    (e) =>
      e.fields.Status === "Pending" &&
      (e.fields["Internal Team Member Account"] ?? []).includes(pid),
  );
  const verdict =
    pct === 0 ? "SKIP (rate is 0)" : dup ? "SKIP (already paid)" : "WOULD CREATE";
  console.log(
    `  ${verdict}: ${name}  ${Math.round(pct * 100)}% × $${f.Cost ?? 0} = $${round2((f.Cost ?? 0) * pct)}` +
      `  payee=${email ?? "(no collaborator!)"}  batch=${batch ? batch.fields["Expense Name"] : "(would create new)"}`,
  );
}
