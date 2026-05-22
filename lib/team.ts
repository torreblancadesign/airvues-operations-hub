// Team page data layer — internal people + payment ledger.
import "server-only";

import { listRecordsCached } from "./airtable";
import { Tables } from "./schema";

export type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  type: string | null;          // Internal / Internal team member
  internalType: string | null;  // Employee / Contractor
  status: string | null;        // Active / Onboarding / Former / etc.
  compType: string | null;
  compAmount: number | null;
  payFrequency: string | null;
  commissionPct: number | null;
  pandaDocStatus: string | null;
  onboardingStatus: string | null;
  reportingManagerId: string | null;
  startDate: string | null;
  totalPaid: number;
  needsPayment: number;
  airtableUrl: string;
};

export type Payment = {
  id: string;
  amount: number;
  status: string | null;     // Needs Payment / Paid
  function: string | null;   // Engineer / BA
  payeeEmail: string | null;
  payeeName: string | null;
  personId: string | null;   // People recId via "Internal Team Member Account (from Link to Expenses)" lookup
  date: string | null;
  invoiceId: string | null;
  client: string | null;
  project: string | null;
  airtableUrl: string;
};

export type TeamData = {
  members: TeamMember[];
  payments: Payment[];
};

export async function listTeamData(): Promise<TeamData> {
  const pT = Tables.People;
  const tT = Tables.TeamTaskPayments;

  const [people, payments] = await Promise.all([
    listRecordsCached<{
      "Full Name"?: string;
      "Primary Email"?: string;
      "Type"?: string;
      "Internal Type"?: string;
      "Status"?: string;
      "Comp Type"?: string;
      "Comp Amount"?: number;
      "Pay Frequency"?: string;
      "PandaDoc Offer Status"?: string;
      "Onboarding Status"?: string;
      "Reporting Manager"?: string[];
      "Start Date"?: string;
    }>(
      pT.id,
      {
        filterByFormula: `OR({Type}='Internal', {Type}='Internal team member')`,
        fields: [
          pT.fields["Full Name"].id,
          pT.fields["Primary Email"].id,
          pT.fields["Type"].id,
          pT.fields["Internal Type"].id,
          pT.fields["Status"].id,
          pT.fields["Comp Type"].id,
          pT.fields["Comp Amount"].id,
          pT.fields["Pay Frequency"].id,
          pT.fields["PandaDoc Offer Status"].id,
          pT.fields["Onboarding Status"].id,
          pT.fields["Reporting Manager"].id,
          pT.fields["Start Date"].id,
        ],
      },
      ["team:internal-people"],
    ),
    listRecordsCached<{
      Amount?: number;
      Status?: string;
      Function?: string;
      Payee?: { id: string; email?: string; name?: string };
      Date?: string;
      "Client Invoice"?: string[];
      Client?: string;
      Project?: string[];
    }>(
      tT.id,
      {
        fields: [
          tT.fields["Amount"].id,
          tT.fields["Status"].id,
          tT.fields["Function"].id,
          tT.fields["Payee"].id,
          tT.fields["Date"].id,
          tT.fields["Client Invoice"].id,
          tT.fields["Client"].id,
          tT.fields["Project"].id,
        ],
      },
      ["team:payments"],
    ),
  ]);

  // Aggregate payments by email
  const paidByEmail = new Map<string, number>();
  const owedByEmail = new Map<string, number>();
  for (const p of payments) {
    const f = p.fields;
    const payee = f.Payee as { email?: string } | undefined;
    const email = payee?.email ?? null;
    if (!email) continue;
    const amt = (f.Amount as number) ?? 0;
    if (f.Status === "Paid") paidByEmail.set(email, (paidByEmail.get(email) ?? 0) + amt);
    if (f.Status === "Needs Payment") owedByEmail.set(email, (owedByEmail.get(email) ?? 0) + amt);
  }

  const members: TeamMember[] = people.map((p) => {
    const f = p.fields;
    const email = (f["Primary Email"] as string) ?? null;
    return {
      id: p.id,
      name: (f["Full Name"] as string) ?? "(no name)",
      email,
      type: (f["Type"] as string) ?? null,
      internalType: (f["Internal Type"] as string) ?? null,
      status: (f["Status"] as string) ?? null,
      compType: (f["Comp Type"] as string) ?? null,
      compAmount: (f["Comp Amount"] as number) ?? null,
      payFrequency: (f["Pay Frequency"] as string) ?? null,
      commissionPct: null,
      pandaDocStatus: (f["PandaDoc Offer Status"] as string) ?? null,
      onboardingStatus: (f["Onboarding Status"] as string) ?? null,
      reportingManagerId: ((f["Reporting Manager"] as string[] | undefined) ?? [])[0] ?? null,
      startDate: (f["Start Date"] as string) ?? null,
      totalPaid: email ? paidByEmail.get(email) ?? 0 : 0,
      needsPayment: email ? owedByEmail.get(email) ?? 0 : 0,
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${pT.id}/${p.id}`,
    };
  });

  const enrichedPayments: Payment[] = payments.map((p) => {
    const f = p.fields;
    const payee = f.Payee as { email?: string; name?: string } | undefined;
    const clientArr = f.Client as string | undefined;
    const projectArr = (f.Project as string[] | undefined) ?? [];
    return {
      id: p.id,
      amount: (f.Amount as number) ?? 0,
      status: (f.Status as string) ?? null,
      function: (f.Function as string) ?? null,
      payeeEmail: payee?.email ?? null,
      payeeName: payee?.name ?? null,
      date: (f.Date as string) ?? null,
      invoiceId: ((f["Client Invoice"] as string[] | undefined) ?? [])[0] ?? null,
      client: clientArr ?? null,
      project: projectArr[0] ?? null,
      airtableUrl: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${tT.id}/${p.id}`,
    };
  });

  return { members, payments: enrichedPayments };
}
