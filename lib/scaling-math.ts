// Pure math for the Team Scaling & Margin Simulator. No I/O.
// Safe to import from server or client.

export const SALARIED_ENGINEER_COMMISSION = 0.15;
export const COMMISSION_ONLY_ENGINEER_COMMISSION = 0.30;
// Head of Client Solutions: 10% sales + 5% blueprint = 15% (assume always blueprinting).
export const CLIENT_SOLUTIONS_COMMISSION = 0.15;

export const DEFAULT_HOURS_PER_MONTH = 160;
export const DEFAULT_HOURLY_RATE = 150;

export type CommissionBase = "projects" | "projects+retainers";

export type EngineerTier = {
  id: string;
  label: string;
  count: number;
  monthlySalary: number; // 0 for commission-only
  commissionRate: number; // 0..1
  hoursPerMonth: number; // capacity per head
  appliesTo: CommissionBase;
};

export type SalesRole = {
  count: number;
  monthlySalary: number;
  commissionRate: number; // 0..1
  appliesTo: CommissionBase;
};

export type ScalingInputs = {
  v: 2;
  monthlyProjectRevenue: number;
  monthlyRetainerRevenue: number;
  revenueHourlyRate: number; // $/hr blended billing rate

  salariedEngineers: EngineerTier[];
  commissionOnlyEngineers: EngineerTier[];

  clientSolutions: SalesRole;
  otherFixed: { count: number; monthlySalary: number };

  overhead: number;
  targetMarginPct: number; // 0..1
  founderOwnership: number; // 0..1
  desiredMonthlyNet: number;
  employerPayrollTaxRate: number; // 0..1
};

export type TierBreakdown = {
  id: string;
  label: string;
  kind: "salaried" | "commission";
  capacityHours: number;
  usedHours: number;
  utilizationPct: number; // 0..1+
  revenue: number;
  commission: number;
  salary: number;
};

export type HiringSignal =
  | { kind: "healthy"; message: string }
  | { kind: "warn"; message: string }
  | { kind: "hire"; message: string; salariedNeeded: number; commissionNeeded: number; unmetHours: number };

export type ScalingOutput = {
  totalRevenue: number;
  fixedSalaries: number;
  commissions: {
    salariedEngineers: number;
    commissionOnlyEngineers: number;
    clientSolutions: number;
    total: number;
  };
  totalTeamCost: number;
  grossProfit: number;
  netMarginPct: number;
  marginPct: number;
  founderDistributable: number;
  founderGrossMonthly: number;
  founderNetMonthly: number;
  founderNetAnnual: number;
  gapToDesiredMonthly: number;
  headroomRevenue: number;
  verdict: "healthy" | "tight" | "below";

  // Capacity
  projectHoursNeeded: number;
  salariedCapacityHours: number;
  commissionCapacityHours: number;
  salariedHoursUsed: number;
  commissionHoursUsed: number;
  unmetHours: number;
  tierBreakdown: TierBreakdown[];
  hiring: HiringSignal;
};

function commissionBase(applies: CommissionBase, p: number, r: number): number {
  return applies === "projects+retainers" ? p + r : p;
}

function fillTiers(
  tiers: EngineerTier[],
  hoursToFill: number,
  hourlyRate: number,
  retainerRev: number,
): { used: number; tierUse: Map<string, number> } {
  const tierUse = new Map<string, number>();
  let remaining = hoursToFill;
  let totalUsed = 0;
  for (const t of tiers) {
    const cap = Math.max(0, t.count * t.hoursPerMonth);
    if (cap <= 0 || remaining <= 0) {
      tierUse.set(t.id, 0);
      continue;
    }
    const used = Math.min(cap, remaining);
    tierUse.set(t.id, used);
    remaining -= used;
    totalUsed += used;
  }
  // Mark anything unset
  for (const t of tiers) if (!tierUse.has(t.id)) tierUse.set(t.id, 0);
  void hourlyRate;
  void retainerRev;
  return { used: totalUsed, tierUse };
}

export function computeScenario(inp: ScalingInputs): ScalingOutput {
  const totalRevenue = inp.monthlyProjectRevenue + inp.monthlyRetainerRevenue;
  const hourly = Math.max(1, inp.revenueHourlyRate);

  const otherFixed = inp.otherFixed.count * inp.otherFixed.monthlySalary;
  const salariedSalaryTotal = inp.salariedEngineers.reduce(
    (a, t) => a + t.count * t.monthlySalary,
    0,
  );
  const commissionSalaryTotal = inp.commissionOnlyEngineers.reduce(
    (a, t) => a + t.count * t.monthlySalary,
    0,
  );
  const fixedSalaries =
    salariedSalaryTotal +
    commissionSalaryTotal +
    inp.clientSolutions.count * inp.clientSolutions.monthlySalary +
    otherFixed;

  // Capacity-driven fill
  const projectHoursNeeded = inp.monthlyProjectRevenue / hourly;
  const salariedCapacityHours = inp.salariedEngineers.reduce(
    (a, t) => a + t.count * t.hoursPerMonth,
    0,
  );
  const commissionCapacityHours = inp.commissionOnlyEngineers.reduce(
    (a, t) => a + t.count * t.hoursPerMonth,
    0,
  );

  const sal = fillTiers(inp.salariedEngineers, projectHoursNeeded, hourly, inp.monthlyRetainerRevenue);
  const remainingAfterSalaried = Math.max(0, projectHoursNeeded - sal.used);
  const com = fillTiers(inp.commissionOnlyEngineers, remainingAfterSalaried, hourly, inp.monthlyRetainerRevenue);

  const salariedHoursUsed = sal.used;
  const commissionHoursUsed = com.used;
  const unmetHours = Math.max(0, projectHoursNeeded - salariedHoursUsed - commissionHoursUsed);

  // Per-tier breakdown + commission pools
  const tierBreakdown: TierBreakdown[] = [];

  let cSalEng = 0;
  for (const t of inp.salariedEngineers) {
    const used = sal.tierUse.get(t.id) ?? 0;
    const projectRev = used * hourly;
    const base = commissionBase(t.appliesTo, projectRev, inp.monthlyRetainerRevenue);
    const comm = base * t.commissionRate;
    cSalEng += comm;
    const cap = t.count * t.hoursPerMonth;
    tierBreakdown.push({
      id: t.id,
      label: t.label || "Salaried tier",
      kind: "salaried",
      capacityHours: cap,
      usedHours: used,
      utilizationPct: cap > 0 ? used / cap : 0,
      revenue: projectRev,
      commission: comm,
      salary: t.count * t.monthlySalary,
    });
  }

  let cCommEng = 0;
  for (const t of inp.commissionOnlyEngineers) {
    const used = com.tierUse.get(t.id) ?? 0;
    const projectRev = used * hourly;
    const base = commissionBase(t.appliesTo, projectRev, inp.monthlyRetainerRevenue);
    const comm = base * t.commissionRate;
    cCommEng += comm;
    const cap = t.count * t.hoursPerMonth;
    tierBreakdown.push({
      id: t.id,
      label: t.label || "Commission tier",
      kind: "commission",
      capacityHours: cap,
      usedHours: used,
      utilizationPct: cap > 0 ? used / cap : 0,
      revenue: projectRev,
      commission: comm,
      salary: t.count * t.monthlySalary,
    });
  }

  const cClientSol =
    inp.clientSolutions.count > 0
      ? commissionBase(
          inp.clientSolutions.appliesTo,
          inp.monthlyProjectRevenue,
          inp.monthlyRetainerRevenue,
        ) * inp.clientSolutions.commissionRate
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

  // Marginal rate for headroom: assume marginal $1 hits salaried first if room, else commission-only.
  const marginalEngineerRate =
    salariedHoursUsed < salariedCapacityHours
      ? (inp.salariedEngineers.find((t) => (sal.tierUse.get(t.id) ?? 0) < t.count * t.hoursPerMonth)?.commissionRate ?? SALARIED_ENGINEER_COMMISSION)
      : (inp.commissionOnlyEngineers.find((t) => (com.tierUse.get(t.id) ?? 0) < t.count * t.hoursPerMonth)?.commissionRate ?? COMMISSION_ONLY_ENGINEER_COMMISSION);
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

  // Hiring signal
  let hiring: HiringSignal;
  if (unmetHours > 0.5) {
    const salariedNeeded = Math.ceil(unmetHours / DEFAULT_HOURS_PER_MONTH);
    const commissionNeeded = salariedNeeded;
    hiring = {
      kind: "hire",
      message: `Need ~${Math.round(unmetHours)} more billable hrs/mo — hire ${salariedNeeded} salaried or ${commissionNeeded} commission-only engineer(s).`,
      salariedNeeded,
      commissionNeeded,
      unmetHours,
    };
  } else {
    const totalCap = salariedCapacityHours + commissionCapacityHours;
    const util = totalCap > 0 ? (salariedHoursUsed + commissionHoursUsed) / totalCap : 0;
    if (util > 0.85) {
      hiring = { kind: "warn", message: `Roster running hot (${Math.round(util * 100)}% utilized) — plan next hire.` };
    } else {
      hiring = { kind: "healthy", message: `Capacity healthy (${Math.round(util * 100)}% utilized).` };
    }
  }

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
    projectHoursNeeded,
    salariedCapacityHours,
    commissionCapacityHours,
    salariedHoursUsed,
    commissionHoursUsed,
    unmetHours,
    tierBreakdown,
    hiring,
  };
}

function newId(): string {
  return `t_${Math.random().toString(36).slice(2, 9)}`;
}

export function makeTier(partial: Partial<EngineerTier> & { kind?: "salaried" | "commission" }): EngineerTier {
  const isSal = partial.kind === "salaried";
  return {
    id: partial.id ?? newId(),
    label: partial.label ?? (isSal ? "Salaried tier" : "Commission tier"),
    count: partial.count ?? 1,
    monthlySalary: partial.monthlySalary ?? (isSal ? 8000 : 0),
    commissionRate:
      partial.commissionRate ??
      (isSal ? SALARIED_ENGINEER_COMMISSION : COMMISSION_ONLY_ENGINEER_COMMISSION),
    hoursPerMonth: partial.hoursPerMonth ?? DEFAULT_HOURS_PER_MONTH,
    appliesTo: partial.appliesTo ?? "projects",
  };
}

export function defaultInputs(seed: {
  monthlyRevenue: number;
  founderOwnership: number;
  desiredMonthlyNet: number;
  payrollTaxRate: number;
}): ScalingInputs {
  return {
    v: 2,
    monthlyProjectRevenue: Math.round(seed.monthlyRevenue * 0.8),
    monthlyRetainerRevenue: Math.round(seed.monthlyRevenue * 0.2),
    revenueHourlyRate: DEFAULT_HOURLY_RATE,
    salariedEngineers: [makeTier({ kind: "salaried", label: "Senior salaried", count: 1 })],
    commissionOnlyEngineers: [
      makeTier({ kind: "commission", label: "Contractor pool", count: 2 }),
    ],
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

// Migrate legacy v1 scenario inputs (single role + mix slider) to v2 (tier lists).
export function migrateInputs(raw: unknown): ScalingInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v === 2 && Array.isArray(r.salariedEngineers) && Array.isArray(r.commissionOnlyEngineers)) {
    return r as unknown as ScalingInputs;
  }
  // v1 shape
  try {
    const salRole = r.salariedEngineers as { count: number; monthlySalary: number; commissionRate: number; appliesTo: CommissionBase } | undefined;
    const comRole = r.commissionOnlyEngineers as { count: number; monthlySalary: number; commissionRate: number; appliesTo: CommissionBase } | undefined;
    const cs = r.clientSolutions as ScalingInputs["clientSolutions"] | undefined;
    if (!salRole || !comRole || !cs) return null;
    return {
      v: 2,
      monthlyProjectRevenue: Number(r.monthlyProjectRevenue) || 0,
      monthlyRetainerRevenue: Number(r.monthlyRetainerRevenue) || 0,
      revenueHourlyRate: DEFAULT_HOURLY_RATE,
      salariedEngineers: [
        makeTier({
          kind: "salaried",
          label: "Salaried",
          count: salRole.count,
          monthlySalary: salRole.monthlySalary,
          commissionRate: salRole.commissionRate,
          appliesTo: salRole.appliesTo,
        }),
      ],
      commissionOnlyEngineers: [
        makeTier({
          kind: "commission",
          label: "Commission-only",
          count: comRole.count,
          monthlySalary: comRole.monthlySalary,
          commissionRate: comRole.commissionRate,
          appliesTo: comRole.appliesTo,
        }),
      ],
      clientSolutions: cs,
      otherFixed: (r.otherFixed as ScalingInputs["otherFixed"]) ?? { count: 0, monthlySalary: 0 },
      overhead: Number(r.overhead) || 0,
      targetMarginPct: Number(r.targetMarginPct) || 0.4,
      founderOwnership: Number(r.founderOwnership) || 0.6,
      desiredMonthlyNet: Number(r.desiredMonthlyNet) || 0,
      employerPayrollTaxRate: Number(r.employerPayrollTaxRate) || 0.0765,
    };
  } catch {
    return null;
  }
}
