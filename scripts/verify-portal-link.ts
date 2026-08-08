// Throwaway end-to-end check of the magic link and the tenant boundary.
// Creates a contact on Gracie Barra, mints a link, redeems it over HTTP,
// asserts the portal shows that client's data and NOT another client's, then
// proves revoking access locks the existing session out. Cleans up after itself.
//
// Needs the dev server on :3000.
// Run: set -a; . ./.env.local; set +a; \
//      node --require ./scripts/server-only-stub.cjs --import tsx ./scripts/verify-portal-link.ts
import { createRecords, deleteRecord, patchRecords } from "../lib/airtable";
import { Tables } from "../lib/schema";
import { signPortalLinkToken } from "../lib/portal-token";

const PEOPLE = Tables.People;
const GRACIE_BARRA = "recEYdixvRsyvHyst";
const BASE = "http://localhost:3000";
const EMAIL = "zz-portal-test@example.com";

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)})`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  let id: string | null = null;
  try {
    const [created] = await createRecords(PEOPLE.id, [
      {
        fields: {
          "First Name": "ZZ",
          "Last Name": "Portal Test",
          "Primary Email": EMAIL,
          Company: [GRACIE_BARRA],
          Type: "External client/partner",
          "Portal Role": "Owner",
          "Portal Access": true,
        },
      },
    ]);
    id = created.id;
    console.log("created contact", id);

    const token = await signPortalLinkToken({
      personId: id,
      companyId: GRACIE_BARRA,
      email: EMAIL,
    });
    if (!token) throw new Error("no signing secret configured");

    // --- redeem ---
    const redeem = await fetch(`${BASE}/portal/verify?t=${token}`, { redirect: "manual" });
    check("redeem redirects", redeem.status, 307);
    const location = redeem.headers.get("location") ?? "";
    check("redirects to the portal, not a denial", location.includes("denied"), false);

    const setCookie = redeem.headers.get("set-cookie") ?? "";
    check("sets a session cookie", setCookie.includes("airvues-portal-session"), true);
    check("cookie is httpOnly", /httponly/i.test(setCookie), true);
    const cookie = setCookie.split(";")[0];

    // --- the portal, signed in ---
    const page = await (await fetch(`${BASE}/portal`, { headers: { cookie } })).text();
    check("greets the signed-in contact", page.includes("ZZ Portal Test"), true);
    check("shows their retainer", page.includes("Platinum"), true);
    check("shows the agreed response times", page.includes("We respond within"), true);

    // --- the tenant boundary ---
    check(
      "does NOT leak another client's retainer",
      page.includes("North London") || page.includes("DR.BRONNER"),
      false,
    );

    // --- revocation beats a live session ---
    await patchRecords(PEOPLE.id, [{ id, fields: { "Portal Access": false } }]);
    const after = await (await fetch(`${BASE}/portal`, { headers: { cookie } })).text();
    check("revoking access locks out an existing session", after.includes("Platinum"), false);
    check("and falls back to the sign-in message", after.includes("one-time link"), true);

    // --- an expired/garbage token is refused ---
    const bad = await fetch(`${BASE}/portal/verify?t=not-a-token`, { redirect: "manual" });
    check(
      "a forged token is refused",
      (bad.headers.get("location") ?? "").includes("denied=expired"),
      true,
    );
  } finally {
    if (id) {
      await deleteRecord(PEOPLE.id, id);
      console.log("deleted", id);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
