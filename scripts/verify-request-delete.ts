// Throwaway verification of the request-delete cascade.
// Creates its own request + 2 comments, deletes them, proves the comments went
// with it and that a pre-existing unrelated comment survived. Touches nothing
// that was already in the base.
//
// Run: set -a; . ./.env.local; set +a; \
//      node --require ./scripts/server-only-stub.cjs --import tsx ./scripts/verify-request-delete.ts
import { createRecords, deleteRecord, getRecord, listRecords } from "../lib/airtable";
import { Tables } from "../lib/schema";

const REQ = Tables.RetainerRequests;
const CMT = Tables.RetainerRequestComments;
const RETAINER = "recdqlxjQfwGOaoFI"; // Gracie Barra

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)})`);
  if (!ok) process.exitCode = 1;
}

async function commentsFor(requestId: string) {
  const all = await listRecords<Record<string, unknown>>(CMT.id, {
    fields: [CMT.fields["Request"].id],
  });
  return all.filter((c) => {
    const link = c.fields["Request"];
    return Array.isArray(link) && link.includes(requestId);
  });
}

async function main() {
  const commentsBefore = (
    await listRecords<Record<string, unknown>>(CMT.id, { fields: [CMT.fields["Request"].id] })
  ).length;

  const [req] = await createRecords(REQ.id, [
    {
      fields: {
        Title: "ZZ Test — delete cascade",
        Retainer: [RETAINER],
        "Client Priority": "Low",
        Status: "Submitted",
        "Submitted At": "2026-08-08T17:00:00.000Z",
      },
    },
  ]);
  console.log("created request", req.id);

  await createRecords(CMT.id, [
    { fields: { Label: "ZZ c1", Request: [req.id], "Author Side": "Client", Body: "one" } },
    { fields: { Label: "ZZ c2", Request: [req.id], "Author Side": "Airvues", Body: "two" } },
  ]);

  check("two comments attached", (await commentsFor(req.id)).length, 2);

  // --- the cascade, identical to deleteRetainerRequest ---
  const rec = await getRecord<Record<string, unknown>>(REQ.id, req.id);
  const storiesKept = Array.isArray(rec.fields["Stories"])
    ? (rec.fields["Stories"] as string[]).length
    : 0;
  const mine = await commentsFor(req.id);
  for (const c of mine) {
    await deleteRecord(CMT.id, c.id);
    await new Promise((r) => setTimeout(r, 220));
  }
  await deleteRecord(REQ.id, req.id);

  check("reported 0 stories kept", storiesKept, 0);
  check("its comments are gone", (await commentsFor(req.id)).length, 0);

  const commentsAfter = (
    await listRecords<Record<string, unknown>>(CMT.id, { fields: [CMT.fields["Request"].id] })
  ).length;
  check("no unrelated comment was destroyed", commentsAfter, commentsBefore);

  const leftovers = (
    await listRecords<Record<string, unknown>>(REQ.id, { fields: [REQ.fields["Title"].id] })
  ).filter((r) => String(r.fields["Title"] ?? "").startsWith("ZZ Test"));
  check("no test requests left in the base", leftovers.length, 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
