// Pure math for the Team Scaling & Margin Simulator. No I/O.
// Safe to import from server or client.

export const SALARIED_ENGINEER_COMMISSION = 0.15;
export const COMMISSION_ONLY_ENGINEER_COMMISSION = 0.30;
// Head of Client Solutions: 10% sales + 5% blueprint = 15% (assume always blueprinting).
export const CLIENT_SOLUTIONS_COMMISSION = 0.15;

export type CommissionBase = "projects" | "projects+retainers";

export type RoleGroup = {
  count: number;
  monthlySalary: number; // 0 for commission-only
  commissionRate: number; // 0..1
  appliesTo: CommissionBase;
};

export type ScalingInputs = {
  // Revenue
  monthlyProjectRevenue: number;
  monthlyRetainerRevenue: number;

  // Team
  salariedEngineers: RoleGroup;
  commissionOnlyEngineers: RoleGroup;
  clientSolutions: RoleGroup;
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
  netMarginPct: number; // grossProfit / totalRevenue
  founderDistributable: number;
  founderGrossMonthly: number;
  founderNetMonthly: number;
  founderNetAnnual: number;
  gapToDesiredMonthly: number; // desired - actual (>=0)
  headroomRevenue: number; // extra $/mo possible before margin drops below target with current team
  verdict: "healthy" | "tight" | "below";
};

function commissionBase(
  group: RoleGroup,
  projectRev: number,
  retainerRev: number,
): number {
  return group.appliesTo === "projects+retainers"
    ? projectRev + retainerRev
    : projectRev;
}

export function computeScenario(inp: ScalingInputs): ScalingOutput {
  const totalRevenue = inp.monthlyProjectRevenue + inp.monthlyRetainerRevenue;

  const fixedSalaries =
    inp.salariedEngineers.count * inp.salariedEngineers.monthlySalary +
    inp.clientSolutions.count * inp.clientSolutions.monthlySalary +
    inp.otherFixed.count * inp.otherFixed.monthlySalary;

  const cSalEng =
    inp.salariedEngineers.count *
    commissionBase(inp.salariedEngineers, inp.monthlyProjectRevenue, inp.monthlyRetainerRevenue) *
    inp.salariedEngineers.commissionRate;

  // Commission-only engineers split project work — model as rate applied once
  // to the project revenue pool (not per head), since adding more comm-only
  // engineers shouldn't multiply payouts on the same revenue.
  const cCommEng =
    inp.commissionOnlyEngineers.count > 0
      ? commissionBase(
          inp.commissionOnlyEngineers,
          inp.monthlyProjectRevenue,
          inp.monthlyRetainerRevenue,
        ) * inp.commissionOnlyEngineers.commissionRate
      : 0;

  const cClientSol =
    inp.clientSolutions.count *
    commissionBase(inp.clientSolutions, inp.monthlyProjectRevenue, inp.monthlyRetainerRevenue) *
    inp.clientSolutions.commissionRate;

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

  // Headroom: extra project revenue before margin drops below target.
  // Approximation: hold commission rates constant on additional project revenue.
  // Effective marginal rate on extra $1 of project revenue:
  //   1 - (salariedEngs.count * salariedRate + commOnly>0 ? commOnlyRate : 0 + clientSol.count * clientSolRate)
  const marginalCommissionRate =
    inp.salariedEngineers.count * inp.salariedEngineers.commissionRate +
    (inp.commissionOnlyEngineers.count > 0 ? inp.commissionOnlyEngineers.commissionRate : 0) +
    inp.clientSolutions.count * inp.clientSolutions.commissionRate;
  const marginalKeep = 1 - marginalCommissionRate;
  // Solve: (grossProfit + x * marginalKeep) / (totalRevenue + x) >= target
  // => grossProfit + x*marginalKeep >= target*(totalRevenue + x)
  // => x*(marginalKeep - target) >= target*totalRevenue - grossProfit
  let headroomRevenue = 0;
  const denom = marginalKeep - inp.targetMarginPct;
  if (denom > 0) {
    const needed = inp.targetMarginPct * totalRevenue - grossProfit;
    headroomRevenue = needed <= 0 ? Infinity : needed / denom;
  } else {
    headroomRevenue = netMarginPct >= inp.targetMarginPct ? 0 : 0;
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
