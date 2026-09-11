// Throwaway verification: create a company-scoped custom plan, prove
// plansAvailableFor offers it to exactly one client, retire it, delete it.
// Leaves the base as it was found.
//
// Run: set -a; . ./.env.local; set +a; \
//      node --require ./scripts/server-only-stub.cjs --import tsx ./scripts/verify-custom-plan-scoping.ts
import { createRecords, deleteRecord, patchRecords } from "../lib/airtable";
import { Tables } from "../lib/schema";
import { listRetainerTiers } from "../lib/retainers";
import { plansAvailableFor } from "../lib/retainer-catalog";

const NORTH_LONDON = "recO4vOUAY7s1V32I";
const GRACIE_BARRA = "recEYdixvRsyvHyst";
const NAME = "ZZ Test — Custom";

const TIER = Tables.RetainerTiers;

function check(label: string, actual: boolean, expected: boolean) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  let id: string | null = null;
  try {
    const [created] = await createRecords(TIER.id, [
      {
        fields: {
          "Tier Name": NAME,
          Rank: 900,
          Active: true,
          "Monthly Rate": 1,
          "Included Hours": 1,
          "SLA — Urgent (business hrs)": 1,
          Custom: true,
          "Custom For": [NORTH_LONDON],
        },
      },
    ]);
    id = created.id;
    console.log("created", id);

    let tiers = await listRetainerTiers({ fresh: true });
    const mine = tiers.find((t) => t.id === id);
    console.log(
      "read back -> custom:", mine?.custom,
      "| customForCompanyId:", mine?.customForCompanyId,
      "| slaHours.Urgent:", mine?.slaHours.Urgent,
    );

    const has = (companyId: string | null) =>
      plansAvailableFor(tiers, companyId).some((t) => t.id === id);

    check("offered to its own client (North London)", has(NORTH_LONDON), true);
    check("NOT offered to another client (Gracie Barra)", has(GRACIE_BARRA), false);
    check("NOT offered when companyId is null", has(null), false);
    check(
      "catalog for Gracie Barra still has the 7 real plans",
      plansAvailableFor(tiers, GRACIE_BARRA).filter((t) => !t.custom).length === 7,
      true,
    );

    // Retire it, then confirm a retired plan leaves every picker but stays readable.
    await patchRecords(TIER.id, [{ id, fields: { Active: false } }]);
    tiers = await listRetainerTiers({ fresh: true });
    check("retired plan is gone from its own client's picker", has(NORTH_LONDON), false);
    check(
      "retired plan is still readable for display",
      tiers.some((t) => t.id === id && t.active === false),
      true,
    );
  } finally {
    if (id) {
      await deleteRecord(TIER.id, id);
      console.log("deleted", id);
    }
    const left = (await listRetainerTiers({ fresh: true })).filter((t) =>
      t.name.startsWith("ZZ Test"),
    );
    console.log(`${left.length} test plans left in the base`);
    if (left.length !== 0) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
