// Pure projection math for the Founder Dashboard. No I/O, no Airtable.
// Safe to import from server or client.

export type FounderAssumptions = {
  monthlyGoal: number;
  founderOwnership: number; // 0..1
  engineerCommission: number; // 0..1
  shaniaCommission: number; // 0..1
  fixedTeamCost: number;
  overhead: number;
};

export const DEFAULT_ASSUMPTIONS: FounderAssumptions = {
  monthlyGoal: 115_000,
  founderOwnership: 0.6,
  engineerCommission: 0.225,
  shaniaCommission: 0.1,
  fixedTeamCost: 11_000,
  overhead: 1_000,
};

export type FounderProjection = {
  revenue: number;
  variableRate: number;
  fixedMonthly: number;
  monthlyProfit: number;
  founderMonthly: number;
  founderAnnual: number;
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
  const progressToGoal = a.monthlyGoal > 0 ? revenue / a.monthlyGoal : 0;
  return {
    revenue,
    variableRate,
    fixedMonthly,
    monthlyProfit,
    founderMonthly,
    founderAnnual,
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
