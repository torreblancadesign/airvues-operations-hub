#!/usr/bin/env node
// Hygiene: re-classify Companies misclassified as "New" with actual paid revenue.
//
// Rule (conservative — only touches companies currently marked "New"):
//   lifetime paid revenue > $1K → eligible for reclassification
//   < 90d since last paid invoice  → Active
//   90-180d                        → Occasional
//   180-365d                       → Iddle  (sic — that's the Airtable spelling)
//   365d+                          → Lost
//
// Usage:
//   node scripts/hygiene-companies.mjs              (dry-run, no writes)
//   node scripts/hygiene-companies.mjs --apply      (writes to Airtable)
//
// Output: scripts/output/hygiene-companies-{timestamp}-{mode}.json
// Rollback: each apply writes a separate {timestamp}-rollback.json with OLD values.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

// --- Load .env.local ---
const envPath = resolve(PROJECT_ROOT, ".env.local");
if (!existsSync(envPath)) {
  console.error(`ERROR: ${envPath} not found`);
  process.exit(1);
}
const env = readFileSync(envPath, "utf-8")
  .split("\n")
  .filter((line) => line.trim() && !line.startsWith("#"))
  .reduce((acc, line) => {
    const idx = line.indexOf("=");
    if (idx === -1) return acc;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    acc[k] = v;
    return acc;
  }, {});

const BASE_ID = env.AIRTABLE_BASE_ID;
const TOKEN = env.AIRTABLE_TOKEN;
const APPLY = process.argv.includes("--apply");

if (!BASE_ID || !TOKEN) {
  console.error("ERROR: AIRTABLE_BASE_ID or AIRTABLE_TOKEN missing in .env.local");
  process.exit(1);
}

const HEADERS = { Authorization: `Bearer ${TOKEN}` };
const TBL_COMPANIES = "tblQ3hxcIEUQPLN6f";
const TBL_INVOICES = "tblBrtvazPOkXrB80";
const TBL_PEOPLE = "tbl9wvZY9M7Y7hcf1";

// Companies excluded from auto-reclassification — name = placeholder/test/needs manual triage.
// Lee approved excluding "Unknown" on 2026-05-17 (had $36K attributed revenue, name is a stub).
const SKIP_NAMES = new Set(["Unknown"]);

// ---- Airtable helpers ----
async function fetchAll(tableId, { fields, filterByFormula } = {}) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams();
    if (fields) fields.forEach((f) => params.append("fields[]", f));
    if (filterByFormula) params.set("filterByFormula", filterByFormula);
    if (offset) params.set("offset", offset);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`;
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) {
      throw new Error(`Fetch ${tableId} failed (${resp.status}): ${await resp.text()}`);
    }
    const data = await resp.json();
    records.push(...data.records);
    offset = data.offset;
    if (offset) await new Promise((r) => setTimeout(r, 250));
  } while (offset);
  return records;
}

async function patchBatch(tableId, patches) {
  for (let i = 0; i < patches.length; i += 10) {
    const chunk = patches.slice(i, i + 10);
    const resp = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${tableId}`,
      {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ records: chunk, typecast: true }),
      },
    );
    if (!resp.ok) {
      throw new Error(`PATCH ${tableId} failed (${resp.status}): ${await resp.text()}`);
    }
    if (i + 10 < patches.length) await new Promise((r) => setTimeout(r, 250));
  }
}

// ---- Rule ----
function proposedFrequency(lifetimeRevenue, lastInvoiceDate) {
  if (lifetimeRevenue <= 1000) return null; // not eligible
  if (!lastInvoiceDate) return null;
  const daysAgo = Math.floor(
    (Date.now() - new Date(lastInvoiceDate).getTime()) / 86_400_000,
  );
  if (daysAgo < 90) return "Active";
  if (daysAgo < 180) return "Occasional";
  if (daysAgo < 365) return "Iddle";
  return "Lost";
}

// ---- Main ----
async function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Hygiene: Companies misclassified as "New"`);
  console.log(`Mode: ${APPLY ? "🔥 APPLY (will write to Airtable)" : "🔍 DRY-RUN (no writes)"}`);
  console.log(`Base: ${BASE_ID}`);
  console.log(`${"=".repeat(60)}\n`);

  console.log("Fetching Companies + Invoices + People...");
  const [companies, invoices, people] = await Promise.all([
    fetchAll(TBL_COMPANIES, {
      fields: ["Name", "Engagement Frequency"],
    }),
    fetchAll(TBL_INVOICES, {
      fields: ["Invoice Amount", "Invoice Status", "Date", "Invoice Payer"],
    }),
    fetchAll(TBL_PEOPLE, { fields: ["Company"] }),
  ]);
  console.log(`  ${companies.length} companies · ${invoices.length} invoices · ${people.length} people\n`);

  // Build Person→Company map
  const personToCompany = new Map();
  for (const p of people) {
    const cids = p.fields.Company ?? [];
    if (cids.length > 0) personToCompany.set(p.id, cids[0]);
  }

  // Aggregate paid invoices per company
  const revenue = new Map();
  const lastDate = new Map();
  for (const inv of invoices) {
    if (inv.fields["Invoice Status"] !== "paid") continue;
    const date = inv.fields.Date ?? null;
    const amount = inv.fields["Invoice Amount"] ?? 0;
    const payerIds = inv.fields["Invoice Payer"] ?? [];
    for (const pid of payerIds) {
      const cid = personToCompany.get(pid);
      if (!cid) continue;
      revenue.set(cid, (revenue.get(cid) ?? 0) + amount);
      const existing = lastDate.get(cid);
      if (!existing || (date && date > existing)) lastDate.set(cid, date);
    }
  }

  // Find proposals (only touch companies currently marked "New")
  const proposals = [];
  const skipped = [];
  for (const c of companies) {
    const currentFreq = c.fields["Engagement Frequency"] ?? null;
    if (currentFreq !== "New") continue;

    const lifetimeRev = revenue.get(c.id) ?? 0;
    if (lifetimeRev <= 1000) continue;

    const last = lastDate.get(c.id) ?? null;
    const newFreq = proposedFrequency(lifetimeRev, last);
    if (!newFreq || newFreq === currentFreq) continue;

    const name = c.fields.Name ?? "(unnamed)";
    const proposal = {
      id: c.id,
      name,
      currentFreq,
      newFreq,
      lifetimeRevenue: Math.round(lifetimeRev),
      lastInvoiceDate: last,
      daysSinceLastInvoice: last
        ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000)
        : null,
    };

    if (SKIP_NAMES.has(name)) {
      skipped.push({ ...proposal, reason: "in SKIP_NAMES — manual triage required" });
      continue;
    }
    proposals.push(proposal);
  }

  // Sort by revenue desc
  proposals.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);

  // Breakdown
  const byFreq = {};
  let totalRev = 0;
  for (const p of proposals) {
    byFreq[p.newFreq] = (byFreq[p.newFreq] ?? 0) + 1;
    totalRev += p.lifetimeRevenue;
  }

  console.log(`Found ${proposals.length} misclassified companies (${skipped.length} skipped — manual triage)`);
  console.log(`Total lifetime revenue affected: $${totalRev.toLocaleString()}\n`);
  if (skipped.length > 0) {
    console.log(`Skipped (left unchanged):`);
    for (const s of skipped) {
      console.log(`  · ${s.name} — $${s.lifetimeRevenue.toLocaleString()} (would have been ${s.newFreq})`);
    }
    console.log();
  }
  console.log(`Breakdown by proposed new status:`);
  for (const [freq, count] of Object.entries(byFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`  → ${freq.padEnd(12)} ${count}`);
  }
  console.log(`\nTop 10 by lifetime revenue:`);
  for (const p of proposals.slice(0, 10)) {
    const days = p.daysSinceLastInvoice != null ? `${p.daysSinceLastInvoice}d ago` : "n/a";
    console.log(
      `  $${String(p.lifetimeRevenue).padStart(8).padEnd(8)} · ${p.newFreq.padEnd(12)} · ${days.padEnd(8)} · ${p.name}`,
    );
  }
  if (proposals.length > 10) {
    console.log(`  ... and ${proposals.length - 10} more`);
  }

  // Write report
  const outputDir = resolve(PROJECT_ROOT, "scripts/output");
  mkdirSync(outputDir, { recursive: true });
  const mode = APPLY ? "apply" : "dry";
  const reportPath = join(outputDir, `hygiene-companies-${ts}-${mode}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: ts,
        mode,
        summary: { proposals: proposals.length, skipped: skipped.length, totalRevenue: totalRev, byFreq },
        proposals,
        skipped,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport: ${reportPath}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN COMPLETE. Re-run with --apply to write changes.\n`);
    return;
  }

  if (proposals.length === 0) {
    console.log("\nNothing to apply.");
    return;
  }

  // Save rollback BEFORE applying
  const rollbackPath = join(outputDir, `hygiene-companies-${ts}-rollback.json`);
  writeFileSync(
    rollbackPath,
    JSON.stringify(
      {
        timestamp: ts,
        description: "Reverse-patch: apply this to roll back hygiene-companies",
        patches: proposals.map((p) => ({
          id: p.id,
          name: p.name,
          fields: { "Engagement Frequency": p.currentFreq },
        })),
      },
      null,
      2,
    ),
  );
  console.log(`Rollback saved: ${rollbackPath}`);

  console.log(`\nApplying ${proposals.length} updates...`);
  const patches = proposals.map((p) => ({
    id: p.id,
    fields: { "Engagement Frequency": p.newFreq },
  }));
  await patchBatch(TBL_COMPANIES, patches);
  console.log(`✓ Applied. Verify against https://airvues-ops.vercel.app/clients\n`);
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
