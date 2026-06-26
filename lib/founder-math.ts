// Pure projection math for the Founder Dashboard. No I/O, no Airtable.
// Safe to import from server or client.

export type FounderAssumptions = {
  monthlyGoal: number;
  founderOwnership: number; // 0..1
  // Commission model: each $ of project revenue is delivered by ONE engineer
  // (salaried OR commission-only) — so engineer commissions don't stack across
  // the roster. `salariedMixPct` is the share of project work handled by
  // salaried engineers. Client Solutions adds on top of every new sale.
  salariedEngineerRate: number; // 0..1, default 0.15
  commissionOnlyRate: number; // 0..1, default 0.30
  clientSolutionsRate: number; // 0..1, default 0.15
  salariedMixPct: number; // 0..1, share of project rev done by salaried eng
  fixedTeamCost: number;
  overhead: number;
  employerPayrollTaxRate: number; // 0..1, employer-side FICA on founder comp
  targetMarginPct: number; // 0..1, for healthy/tight/below tone
};

export const DEFAULT_ASSUMPTIONS: FounderAssumptions = {
  monthlyGoal: 115_000,
  founderOwnership: 0.6,
  salariedEngineerRate: 0.15,
  commissionOnlyRate: 0.30,
  clientSolutionsRate: 0.15,
  salariedMixPct: 0.6,
  fixedTeamCost: 11_000,
  overhead: 1_000,
  employerPayrollTaxRate: 0.0765, // 6.2% SS + 1.45% Medicare
  targetMarginPct: 0.4,
};

export function effectiveVariableRate(a: FounderAssumptions): number {
  const engineerRate =
    a.salariedMixPct * a.salariedEngineerRate +
    (1 - a.salariedMixPct) * a.commissionOnlyRate;
  return engineerRate + a.clientSolutionsRate;
}

export type FounderProjection = {
  revenue: number;
  variableRate: number;
  fixedMonthly: number;
  monthlyProfit: number;
  marginPct: number; // monthlyProfit / revenue
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
  const variableRate = effectiveVariableRate(a);
  const fixedMonthly = a.fixedTeamCost + a.overhead;
  const monthlyProfit = revenue * (1 - variableRate) - fixedMonthly;
  const marginPct = revenue > 0 ? monthlyProfit / revenue : 0;
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
    marginPct,
    founderMonthly,
    founderAnnual,
    payrollTaxMonthly,
    payrollTaxAnnual,
    founderNetMonthly,
    founderNetAnnual,
    progressToGoal,
  };
}

// Back-solve: what monthly revenue is required to net `retirementAnnual`
// take-home/year, given the current assumptions?
export function requiredRevenueForNetAnnual(
  retirementAnnual: number,
  a: FounderAssumptions,
): number {
  if (!Number.isFinite(retirementAnnual) || retirementAnnual <= 0) return 0;
  const variableRate = effectiveVariableRate(a);
  const fixedMonthly = a.fixedTeamCost + a.overhead;
  if (a.founderOwnership <= 0) return Infinity;
  if (1 - a.employerPayrollTaxRate <= 0) return Infinity;
  if (1 - variableRate <= 0) return Infinity;
  const founderNetMonthly = retirementAnnual / 12;
  const founderMonthly = founderNetMonthly / (1 - a.employerPayrollTaxRate);
  const monthlyProfit = founderMonthly / a.founderOwnership;
  const revenue = (monthlyProfit + fixedMonthly) / (1 - variableRate);
  return revenue > 0 ? revenue : 0;
}

export const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));


export const fmtPct1 = (n: number) => `${(n * 100).toFixed(1)}%`;

export type MarginVerdict = "healthy" | "tight" | "below";
export function marginVerdict(margin: number, target: number): MarginVerdict {
  if (margin >= target) return "healthy";
  if (margin >= target - 0.05) return "tight";
  return "below";
}
export function marginToneClass(v: MarginVerdict): string {
  return v === "healthy" ? "text-emerald" : v === "tight" ? "text-amber" : "text-red";
}

export type MonthsToGoalPrediction =
  | { kind: "at-goal" }
  | { kind: "flat" }
  | { kind: "months"; value: number };

export function predictMonthsToGoal(args: {
  currentMonthlyRevenue: number;
  monthlyGoal: number;
  avgMonthlyGrowth: number;
}): MonthsToGoalPrediction {
  const { currentMonthlyRevenue, monthlyGoal, avgMonthlyGrowth } = args;
  if (!Number.isFinite(monthlyGoal) || monthlyGoal <= 0) return { kind: "flat" };
  if (currentMonthlyRevenue >= monthlyGoal) return { kind: "at-goal" };
  if (!Number.isFinite(avgMonthlyGrowth) || avgMonthlyGrowth <= 0) return { kind: "flat" };
  const gap = monthlyGoal - currentMonthlyRevenue;
  const months = Math.ceil(gap / avgMonthlyGrowth);
  if (!Number.isFinite(months) || months <= 0) return { kind: "flat" };
  return { kind: "months", value: months };
}
