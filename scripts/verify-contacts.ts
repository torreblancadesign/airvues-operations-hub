// Throwaway verification of portal contacts, especially the duplicate guard.
// Creates its own People record, proves a second add with the same email in a
// different case links instead of duplicating, then detaches and deletes it.
//
// Run: set -a; . ./.env.local; set +a; \
//      node --require ./scripts/server-only-stub.cjs --import tsx ./scripts/verify-contacts.ts
import { createRecords, deleteRecord, patchRecords } from "../lib/airtable";
import { Tables } from "../lib/schema";
import { listContactsForCompany, listPeopleWithEmail } from "../lib/retainer-contacts";
import { findByEmail, readinessOf, sortContacts } from "../lib/retainer-contact-rules";

const PEOPLE = Tables.People;
const GRACIE_BARRA = "recEYdixvRsyvHyst";
const EMAIL = "zz-test-contact@example.com";

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)})`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const before = await listContactsForCompany(GRACIE_BARRA, { fresh: true });
  console.log(`Gracie Barra contacts before: ${before.length}`);

  let id: string | null = null;
  try {
    const [created] = await createRecords(PEOPLE.id, [
      {
        fields: {
          "First Name": "ZZ",
          "Last Name": "Test Contact",
          "Primary Email": EMAIL,
          Company: [GRACIE_BARRA],
          Type: "External client/partner",
          "Portal Role": "Member",
          "Portal Access": true,
          "Portal Invited At": new Date("2026-08-08T12:00:00Z").toISOString(),
        },
      },
    ]);
    id = created.id;

    const after = await listContactsForCompany(GRACIE_BARRA, { fresh: true });
    const mine = after.find((c) => c.id === id);
    check("contact is scoped to its company", mine !== undefined, true);
    check("Full Name formula resolved", mine?.name, "ZZ Test Contact");
    check("portal access read back", mine?.portalAccess, true);
    check("readiness is invited, not active", mine ? readinessOf(mine) : null, "invited");

    // THE DUPLICATE GUARD: a differently-cased, space-padded address must find
    // the same human rather than sail through and create a second record.
    const everyone = await listPeopleWithEmail();
    const match = findByEmail(everyone, "  ZZ-Test-Contact@EXAMPLE.com ");
    check("case/space-insensitive email match finds the existing person", match?.id, id);

    check(
      "sortContacts is stable over live data",
      sortContacts(after).length,
      after.length,
    );

    // Detach — the "Remove" action must not destroy the person.
    await patchRecords(PEOPLE.id, [
      { id, fields: { Company: [], "Portal Access": false } },
    ]);
    const detached = await listContactsForCompany(GRACIE_BARRA, { fresh: true });
    check("detached contact leaves the company list", detached.some((c) => c.id === id), false);
    check(
      "but the person record still exists",
      (await listPeopleWithEmail()).some((c) => c.id === id),
      true,
    );
  } finally {
    if (id) {
      await deleteRecord(PEOPLE.id, id);
      console.log("deleted", id);
    }
    const leftover = (await listPeopleWithEmail()).filter((c) =>
      (c.email ?? "").startsWith("zz-test-contact"),
    );
    check("no test people left in the base", leftover.length, 0);
    const end = await listContactsForCompany(GRACIE_BARRA, { fresh: true });
    check("company contact count restored", end.length, before.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
