// Pure math for the Team Scaling & Margin Simulator. No I/O.
// Safe to import from server or client.

export const SALARIED_ENGINEER_COMMISSION = 0.15;
export const COMMISSION_ONLY_ENGINEER_COMMISSION = 0.30;
// Head of Client Solutions: 10% sales + 5% blueprint = 15% (assume always blueprinting).
export const CLIENT_SOLUTIONS_COMMISSION = 0.15;

export type CommissionBase = "projects" | "projects+retainers";

export type EngineerRole = {
  count: number; // headcount — drives salary cost (salaried) / capacity only
  monthlySalary: number; // 0 for commission-only
  commissionRate: number; // 0..1
  appliesTo: CommissionBase;
};

export type SalesRole = {
  count: number;
  monthlySalary: number;
  commissionRate: number; // 0..1
  appliesTo: CommissionBase;
};

export type ScalingInputs = {
  // Revenue
  monthlyProjectRevenue: number;
  monthlyRetainerRevenue: number;

  // Team
  salariedEngineers: EngineerRole;
  commissionOnlyEngineers: EngineerRole;
  // Share of project revenue delivered by salaried engineers (0..1).
  // Remainder is delivered by commission-only engineers. Each $ of project
  // revenue is touched by exactly one engineer — commissions never stack.
  salariedEngineerMix: number;
  clientSolutions: SalesRole;
  otherFixed: { count: number; monthlySalary: number };

  // Cost & strategy
  overhead: number;
  targetMarginPct: number; // 0..1
  founderOwnership: number; // 0..1
  desiredMonthlyNet: number;
  employerPayrollTaxRate: number; // 0..1
};

export type ScalingOutput = {
  totalRevenue: number;
  fixedSalaries: number;
  commissions: {
    salariedEngineers: number;
    commissionOnlyEngineers: number;
    clientSolutions: number;
    total: number;
  };
  totalTeamCost: number; // salaries + commissions + overhead
  grossProfit: number;
  netMarginPct: number;
  marginPct: number; // alias of netMarginPct
  founderDistributable: number;
  founderGrossMonthly: number;
  founderNetMonthly: number;
  founderNetAnnual: number;
  gapToDesiredMonthly: number;
  headroomRevenue: number;
  verdict: "healthy" | "tight" | "below";
};

function base(group: { appliesTo: CommissionBase }, p: number, r: number): number {
  return group.appliesTo === "projects+retainers" ? p + r : p;
}

export function computeScenario(inp: ScalingInputs): ScalingOutput {
  const totalRevenue = inp.monthlyProjectRevenue + inp.monthlyRetainerRevenue;

  const fixedSalaries =
    inp.salariedEngineers.count * inp.salariedEngineers.monthlySalary +
    inp.clientSolutions.count * inp.clientSolutions.monthlySalary +
    inp.otherFixed.count * inp.otherFixed.monthlySalary;

  // Engineer commission pool — split by mix, never stacked per head.
  const mix = Math.max(0, Math.min(1, inp.salariedEngineerMix));
  const salariedHasEngineers = inp.salariedEngineers.count > 0;
  const commHasEngineers = inp.commissionOnlyEngineers.count > 0;

  // If a side of the mix has no headcount, that share gets handled by the other.
  const effSalariedShare = salariedHasEngineers ? (commHasEngineers ? mix : 1) : 0;
  const effCommShare = commHasEngineers ? (salariedHasEngineers ? 1 - mix : 1) : 0;

  const cSalEng =
    base(inp.salariedEngineers, inp.monthlyProjectRevenue, inp.monthlyRetainerRevenue) *
    effSalariedShare *
    inp.salariedEngineers.commissionRate;

  const cCommEng =
    base(inp.commissionOnlyEngineers, inp.monthlyProjectRevenue, inp.monthlyRetainerRevenue) *
    effCommShare *
    inp.commissionOnlyEngineers.commissionRate;

  // Client Solutions: single role applied to all new sales. Headcount drives
  // salary cost, not commission multiplier.
  const cClientSol =
    inp.clientSolutions.count > 0
      ? base(inp.clientSolutions, inp.monthlyProjectRevenue, inp.monthlyRetainerRevenue) *
        inp.clientSolutions.commissionRate
      : 0;

  const commissionsTotal = cSalEng + cCommEng + cClientSol;

  const totalTeamCost = fixedSalaries + commissionsTotal + inp.overhead;
  const grossProfit = totalRevenue - totalTeamCost;
  const netMarginPct = totalRevenue > 0 ? grossProfit / totalRevenue : 0;

  const founderDistributable = Math.max(0, grossProfit) * inp.founderOwnership;
  const founderGrossMonthly = founderDistributable;
  const payrollTax = founderGrossMonthly * inp.employerPayrollTaxRate;
  const founderNetMonthly = founderGrossMonthly - payrollTax;
  const founderNetAnnual = founderNetMonthly * 12;

  const gapToDesiredMonthly = Math.max(0, inp.desiredMonthlyNet - founderNetMonthly);

  // Marginal rate on extra $1 of project revenue (engineer mix + sales).
  const marginalEngineerRate =
    effSalariedShare * inp.salariedEngineers.commissionRate +
    effCommShare * inp.commissionOnlyEngineers.commissionRate;
  const marginalSalesRate = inp.clientSolutions.count > 0 ? inp.clientSolutions.commissionRate : 0;
  const marginalKeep = 1 - marginalEngineerRate - marginalSalesRate;

  let headroomRevenue = 0;
  const denom = marginalKeep - inp.targetMarginPct;
  if (denom > 0) {
    const needed = inp.targetMarginPct * totalRevenue - grossProfit;
    headroomRevenue = needed <= 0 ? Infinity : needed / denom;
  }

  let verdict: ScalingOutput["verdict"];
  if (netMarginPct >= inp.targetMarginPct) verdict = "healthy";
  else if (netMarginPct >= inp.targetMarginPct - 0.05) verdict = "tight";
  else verdict = "below";

  return {
    totalRevenue,
    fixedSalaries,
    commissions: {
      salariedEngineers: cSalEng,
      commissionOnlyEngineers: cCommEng,
      clientSolutions: cClientSol,
      total: commissionsTotal,
    },
    totalTeamCost,
    grossProfit,
    netMarginPct,
    marginPct: netMarginPct,
    founderDistributable,
    founderGrossMonthly,
    founderNetMonthly,
    founderNetAnnual,
    gapToDesiredMonthly,
    headroomRevenue,
    verdict,
  };
}

export function defaultInputs(seed: {
  monthlyRevenue: number;
  founderOwnership: number;
  desiredMonthlyNet: number;
  payrollTaxRate: number;
}): ScalingInputs {
  return {
    monthlyProjectRevenue: Math.round(seed.monthlyRevenue * 0.8),
    monthlyRetainerRevenue: Math.round(seed.monthlyRevenue * 0.2),
    salariedEngineers: {
      count: 1,
      monthlySalary: 8000,
      commissionRate: SALARIED_ENGINEER_COMMISSION,
      appliesTo: "projects",
    },
    commissionOnlyEngineers: {
      count: 2,
      monthlySalary: 0,
      commissionRate: COMMISSION_ONLY_ENGINEER_COMMISSION,
      appliesTo: "projects",
    },
    salariedEngineerMix: 0.6,
    clientSolutions: {
      count: 1,
      monthlySalary: 6000,
      commissionRate: CLIENT_SOLUTIONS_COMMISSION,
      appliesTo: "projects",
    },
    otherFixed: { count: 0, monthlySalary: 0 },
    overhead: 1000,
    targetMarginPct: 0.4,
    founderOwnership: seed.founderOwnership,
    desiredMonthlyNet: seed.desiredMonthlyNet,
    employerPayrollTaxRate: seed.payrollTaxRate,
  };
}
