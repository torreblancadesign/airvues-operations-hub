// Throwaway verification: archive a retainer, prove it drops out of the
// default board view while keeping every linked request, then restore it.
// Leaves the base exactly as found.
//
// Run: set -a; . ./.env.local; set +a; \
//      node --require ./scripts/server-only-stub.cjs --import tsx ./scripts/verify-archive.ts
import { patchRecords } from "../lib/airtable";
import { Tables } from "../lib/schema";
import { listRetainerAgreements, listRetainerTiers } from "../lib/retainers";
import { listRetainerRequests } from "../lib/retainer-requests";
import { buildBoardRows } from "../lib/retainer-board";

// North London — an unsigned proposal carrying one test request.
const TARGET = "recf9TwdhTZxFZYOJ";
const QUOTE = Tables.Quotes;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)})`);
  if (!ok) process.exitCode = 1;
}

async function board() {
  const [agreements, tiers, requests] = await Promise.all([
    listRetainerAgreements({ fresh: true }),
    listRetainerTiers({ fresh: true }),
    listRetainerRequests(),
  ]);
  return buildBoardRows({
    agreements,
    tiers,
    requests,
    hoursByRetainer: {},
    now: new Date(),
  });
}

async function main() {
  const before = await board();
  const beforeRow = before.find((r) => r.retainerId === TARGET);
  console.log("before:", before.length, "rows | target archived:", beforeRow?.archived);
  check("target starts un-archived", beforeRow?.archived, false);
  const requestsBefore = beforeRow?.openCount ?? 0;

  try {
    await patchRecords(QUOTE.id, [{ id: TARGET, fields: { "Retainer Archived": true } }]);

    const after = await board();
    const row = after.find((r) => r.retainerId === TARGET);

    check("row still exists (soft hide, not a delete)", row !== undefined, true);
    check("row is flagged archived", row?.archived, true);
    check("linked requests are untouched", row?.openCount, requestsBefore);
    check(
      "default board view excludes it",
      after.filter((r) => !r.archived).some((r) => r.retainerId === TARGET),
      false,
    );
    check(
      '"show archived" view includes it',
      after.some((r) => r.retainerId === TARGET),
      true,
    );
  } finally {
    await patchRecords(QUOTE.id, [{ id: TARGET, fields: { "Retainer Archived": false } }]);
    const restored = (await board()).find((r) => r.retainerId === TARGET);
    check("restored to un-archived", restored?.archived, false);
    check("requests survived the round trip", restored?.openCount, requestsBefore);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
