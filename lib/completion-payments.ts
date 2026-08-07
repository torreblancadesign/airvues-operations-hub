// Creates one 🔵 Team Task Payment per assignee when a story completes.
// Each payee earns their own People.Commission Percentage of the FULL story
// Cost (not a split). Duplicate-guarded: assignees who already have a payment
// linked to the story are skipped — payment creation today is partly manual
// and this must never double-pay. Kill switch: DISABLE_COMPLETION_PAYMENTS=1.
import "server-only";

import { createRecords, getRecord, listRecords } from "./airtable";
import { Tables } from "./schema";
import { COMMISSION_RATE } from "./engineering-types";

export type CompletionPaymentsResult = {
  created: { payee: string; amount: number }[];
  skipped: { payee: string; reason: string }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function asIdArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.startsWith("rec"));
}

export async function createCompletionPayments(
  storyId: string,
): Promise<CompletionPaymentsResult> {
  const result: CompletionPaymentsResult = { created: [], skipped: [] };
  if (process.env.DISABLE_COMPLETION_PAYMENTS === "1") {
    result.skipped.push({ payee: "*", reason: "disabled via DISABLE_COMPLETION_PAYMENTS" });
    return result;
  }

  const sTbl = Tables.Stories;
  const pTbl = Tables.People;
  const tTbl = Tables.TeamTaskPayments;
  const eTbl = Tables.AirvuesExpenses;

  const story = await getRecord<Record<string, unknown>>(sTbl.id, storyId);
  const f = story.fields;
  const assigneeIds = asIdArray(f["Assignee"]);
  const cost = typeof f["Cost"] === "number" ? (f["Cost"] as number) : 0;
  const storyName =
    typeof f["Story Name"] === "string" ? (f["Story Name"] as string) : storyId;

  if (assigneeIds.length === 0) {
    result.skipped.push({ payee: "*", reason: "no assignees" });
    return result;
  }
  if (cost <= 0) {
    result.skipped.push({ payee: "*", reason: "story Cost is 0" });
    return result;
  }

  // Existing payments on this story → who is already covered.
  const existingIds = asIdArray(f["🔵 Team Task Payments"]);
  const alreadyPaidPersonIds = new Set<string>();
  const alreadyPaidEmails = new Set<string>();
  for (const pid of existingIds) {
    const pay = await getRecord<Record<string, unknown>>(tTbl.id, pid);
    for (const acct of asIdArray(
      pay.fields["Internal Team Member Account (from Link to Expenses)"],
    )) {
      alreadyPaidPersonIds.add(acct);
    }
    const payee = pay.fields["Payee"] as { email?: string } | undefined;
    if (payee?.email) alreadyPaidEmails.add(payee.email.toLowerCase());
  }

  // People: names, rates, collaborator emails. Uncached — money math must be fresh.
  const people = await listRecords<Record<string, unknown>>(pTbl.id, {
    fields: [
      pTbl.fields["Full Name"].id,
      pTbl.fields["First Name"].id,
      pTbl.fields["Last Name"].id,
      pTbl.fields["Commission Percentage"].id,
      pTbl.fields["Airtable Account"].id,
    ],
  });
  const personMap = new Map(people.map((p) => [p.id, p.fields]));

  // Open Pending expense batches, indexed by person.
  const expenses = await listRecords<Record<string, unknown>>(eTbl.id, {
    fields: [
      eTbl.fields["Expense Name"].id,
      eTbl.fields["Internal Team Member Account"].id,
      eTbl.fields["Status"].id,
    ],
  });
  const openBatchByPerson = new Map<string, string>();
  for (const e of expenses) {
    if (e.fields["Status"] !== "Pending") continue;
    for (const acct of asIdArray(e.fields["Internal Team Member Account"])) {
      openBatchByPerson.set(acct, e.id);
    }
  }

  for (const personId of assigneeIds) {
    const pf = personMap.get(personId);
    const name =
      (pf?.["Full Name"] as string) ||
      [pf?.["First Name"], pf?.["Last Name"]].filter(Boolean).join(" ").trim() ||
      personId;

    const collaborators = pf?.["Airtable Account"] as { email?: string }[] | undefined;
    const email = collaborators?.[0]?.email?.toLowerCase() ?? null;

    if (alreadyPaidPersonIds.has(personId) || (email && alreadyPaidEmails.has(email))) {
      result.skipped.push({ payee: name, reason: "payment already exists for this story" });
      continue;
    }

    const rawPct = pf?.["Commission Percentage"];
    let pct = COMMISSION_RATE;
    if (typeof rawPct === "number") pct = rawPct > 1 ? rawPct / 100 : rawPct;
    if (pct === 0) {
      result.skipped.push({ payee: name, reason: "commission rate is 0" });
      continue;
    }
    const amount = round2(cost * pct);

    // Route to the person's open Pending expense batch; create one if missing.
    let expenseId = openBatchByPerson.get(personId);
    if (!expenseId) {
      const [createdExpense] = await createRecords<Record<string, unknown>>(eTbl.id, [
        {
          fields: {
            "Expense Name": `Project Payments for ${name}`,
            "Internal Team Member Account": [personId],
            Status: "Pending",
            Type: "Contractor Commissions",
          },
        },
      ]);
      expenseId = createdExpense.id;
      openBatchByPerson.set(personId, expenseId);
    }

    await createRecords<Record<string, unknown>>(tTbl.id, [
      {
        fields: {
          Amount: amount,
          Function: "Engineer",
          Status: "Needs Payment",
          ...(email ? { Payee: { email } } : {}),
          Stories: [storyId],
          "Link to Expenses": [expenseId],
          Comments: `Auto-created by Airvues Ops on completion of "${storyName}" (${Math.round(pct * 100)}% of $${cost}).`,
        },
      },
    ]);
    result.created.push({ payee: name, amount });
  }

  return result;
}
