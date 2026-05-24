// Pure projection math for the Founder Dashboard. No I/O, no Airtable.
// Safe to import from server or client.

export type FounderAssumptions = {
  monthlyGoal: number;
  founderOwnership: number; // 0..1
  engineerCommission: number; // 0..1
  shaniaCommission: number; // 0..1
  fixedTeamCost: number;
  overhead: number;
  employerPayrollTaxRate: number; // 0..1, employer-side FICA on founder comp
};

export const DEFAULT_ASSUMPTIONS: FounderAssumptions = {
  monthlyGoal: 115_000,
  founderOwnership: 0.6,
  engineerCommission: 0.225,
  shaniaCommission: 0.1,
  fixedTeamCost: 11_000,
  overhead: 1_000,
  employerPayrollTaxRate: 0.0765, // 6.2% SS + 1.45% Medicare
};

export type FounderProjection = {
  revenue: number;
  variableRate: number;
  fixedMonthly: number;
  monthlyProfit: number;
  founderMonthly: number;
  founderAnnual: number;
  payrollTaxMonthly: number;
  payrollTaxAnnual: number;
  founderNetMonthly: number;
  founderNetAnnual: number;
  progressToGoal: number;
};

export function project(
  revenue: number,
  a: FounderAssumptions,
): FounderProjection {
  const variableRate = a.engineerCommission + a.shaniaCommission;
  const fixedMonthly = a.fixedTeamCost + a.overhead;
  const monthlyProfit = revenue * (1 - variableRate) - fixedMonthly;
  const founderMonthly = monthlyProfit * a.founderOwnership;
  const founderAnnual = founderMonthly * 12;
  const payrollTaxMonthly = founderMonthly * a.employerPayrollTaxRate;
  const payrollTaxAnnual = payrollTaxMonthly * 12;
  const founderNetMonthly = founderMonthly - payrollTaxMonthly;
  const founderNetAnnual = founderNetMonthly * 12;
  const progressToGoal = a.monthlyGoal > 0 ? revenue / a.monthlyGoal : 0;
  return {
    revenue,
    variableRate,
    fixedMonthly,
    monthlyProfit,
    founderMonthly,
    founderAnnual,
    payrollTaxMonthly,
    payrollTaxAnnual,
    founderNetMonthly,
    founderNetAnnual,
    progressToGoal,
  };
}

export const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export const fmtPct1 = (n: number) => `${(n * 100).toFixed(1)}%`;

