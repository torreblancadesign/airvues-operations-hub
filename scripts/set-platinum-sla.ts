// One-shot: write Platinum's first-response SLA and run the same backfill
// lib/mutations/retainer-tier.ts runs, using the real read layer and the real
// pure functions. The Server Action itself cannot run here — "use server" plus
// next/cache need a request context — so this reproduces its body exactly.
// Everything below except requireRole/revalidateTag is the production code path.
//
// Run: set -a; . ./.env.local; set +a; \
//      node --require ./scripts/server-only-stub.cjs --import tsx ./scripts/set-platinum-sla.ts
import { patchRecords } from "../lib/airtable";
import { Tables } from "../lib/schema";
import { listRetainerAgreements, listRetainerTiers } from "../lib/retainers";
import { listRetainerRequests } from "../lib/retainer-requests";
import { computeSlaDueAt, evaluateSlaOutcome } from "../lib/retainer-policy";
import { requestsNeedingSlaRecompute } from "../lib/retainer-board";

const PLATINUM = "recIaQ8Q51Czl98x7";
const HOURS = 4;

const TIER = Tables.RetainerTiers;
const REQ = Tables.RetainerRequests;

async function main() {
  const before = (await listRetainerTiers({ fresh: true })).find((t) => t.id === PLATINUM);
  if (!before) throw new Error("Platinum not found");
  console.log("before:", JSON.stringify(before.slaHours));

  await patchRecords(TIER.id, [
    {
      id: PLATINUM,
      fields: {
        "SLA — Urgent (business hrs)": HOURS,
        "SLA — High (business hrs)": HOURS,
        "SLA — Medium (business hrs)": HOURS,
        "SLA — Low (business hrs)": HOURS,
        "SLA Label (client-facing)": `${HOURS} business hours to first response`,
      },
    },
  ]);

  // --- the backfill, identical to recomputeSlaForPlan ---
  const [tiers, agreements, requests] = await Promise.all([
    listRetainerTiers({ fresh: true }),
    listRetainerAgreements({ fresh: true }),
    listRetainerRequests(),
  ]);

  const tier = tiers.find((t) => t.id === PLATINUM) ?? null;
  if (!tier) throw new Error("Platinum vanished mid-run");
  console.log("after: ", JSON.stringify(tier.slaHours), "| label:", tier.slaLabel);

  const retainerIds = agreements.filter((a) => a.tierId === PLATINUM).map((a) => a.id);
  console.log("retainers on Platinum:", retainerIds.length ? retainerIds.join(", ") : "(none)");

  const affected = requestsNeedingSlaRecompute(requests, retainerIds);
  console.log("requests needing recompute:", affected.length);

  if (affected.length > 0) {
    const now = new Date();
    const patches = affected.map((r) => {
      const dueAt = computeSlaDueAt(tier, r.priority ?? "Medium", new Date(r.submittedAt as string));
      console.log(
        `  ${r.id} ${r.priority} submitted ${r.submittedAt} -> due ${dueAt?.toISOString() ?? "null"}`,
      );
      return {
        id: r.id,
        fields: {
          "SLA Due At": dueAt ? dueAt.toISOString() : null,
          "SLA Outcome": evaluateSlaOutcome({ dueAt, firstRespondedAt: null, now }),
        },
      };
    });
    await patchRecords(REQ.id, patches);
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
