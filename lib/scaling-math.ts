// Pure math for the Team Scaling & Margin Simulator. No I/O.
// Safe to import from server or client.

export const SALARIED_ENGINEER_COMMISSION = 0.15;
export const COMMISSION_ONLY_ENGINEER_COMMISSION = 0.30;
// Head of Client Solutions defaults: 15% on projects, 5% on retainers.
export const CLIENT_SOLUTIONS_PROJECT_COMMISSION = 0.15;
export const CLIENT_SOLUTIONS_RETAINER_COMMISSION = 0.05;

export const DEFAULT_HOURS_PER_MONTH = 160;
export const DEFAULT_PROJECT_HOURLY_RATE = 150;

export type CommissionBase = "projects" | "projects+retainers";

export type EngineerTier = {
  id: string;
  label: string;
  count: number;
  monthlySalary: number; // 0 for commission-only
  commissionRate: number; // 0..1
  hoursPerMonth: number; // capacity per head
  worksOnProjects: boolean;
  worksOnRetainers: boolean;
  retainerCommission: boolean;
  // Manual reservations — hours forced to this tier before priority fill runs.
  manualProjectHours: number;
  manualRetainerHours: number;
  // Legacy
  appliesTo?: CommissionBase;
};

export type Retainer = {
  id: string;
  label: string;
  monthlyRevenue: number;
  supportHoursPerMonth: number;
  appliesToCommission: boolean; // pay ENGINEER commission on this retainer
  paySalesCommission: boolean; // pay SALES (Client Solutions) commission on this retainer
};

export type SalesRole = {
  count: number;
  monthlySalary: number;
  projectCommissionRate: number; // 0..1, applied to all project revenue
  retainerCommissionRate: number; // 0..1, applied to retainers with paySalesCommission
  // Legacy
  commissionRate?: number;
  appliesTo?: CommissionBase;
};

export type ScalingInputs = {
  v: 3;
  monthlyProjectRevenue: number;
  projectHourlyRate: number;

  retainers: Retainer[];

  salariedEngineers: EngineerTier[];
  commissionOnlyEngineers: EngineerTier[];

  clientSolutions: SalesRole;
  otherFixed: { count: number; monthlySalary: number };

  overhead: number;
  targetMarginPct: number;
  founderOwnership: number;
  desiredMonthlyNet: number;
  employerPayrollTaxRate: number;
};

export type TierBreakdown = {
  id: string;
  label: string;
  kind: "salaried" | "commission";
  capacityHours: number;
  usedHours: number;
  retainerHours: number;
  projectHours: number;
  reservedHours: number;
  utilizationPct: number;
  revenue: number;
  commission: number;
  salary: number;
};

export type RetainerCoverage = {
  id: string;
  label: string;
  hoursNeeded: number;
  hoursCovered: number;
  shortHours: number;
};

export type HiringSignal =
  | { kind: "healthy"; message: string }
  | { kind: "warn"; message: string }
  | {
      kind: "hire";
      message: string;
      salariedNeeded: number;
      commissionNeeded: number;
      unmetHours: number;
      reason: "retainer" | "project";
    };

export type ScalingOutput = {
  totalRevenue: number;
  monthlyRetainerRevenue: number;
  fixedSalaries: number;
  commissions: {
    salariedEngineers: number;
    commissionOnlyEngineers: number;
    clientSolutions: number;
    clientSolutionsProjects: number;
    clientSolutionsRetainers: number;
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

  projectHoursNeeded: number;
  retainerHoursNeeded: number;
  salariedCapacityHours: number;
  commissionCapacityHours: number;
  salariedHoursUsed: number;
  commissionHoursUsed: number;
  unmetProjectHours: number;
  unmetRetainerHours: number;
  unmetHours: number;
  tierBreakdown: TierBreakdown[];
  retainerCoverage: RetainerCoverage[];
  hiring: HiringSignal;
};

function fillTiers(
  tiers: EngineerTier[],
  hoursToFill: number,
  remainingCap: Map<string, number>,
): { used: number; tierUse: Map<string, number> } {
  const tierUse = new Map<string, number>();
  let remaining = hoursToFill;
  let totalUsed = 0;
  for (const t of tiers) {
    const cap = remainingCap.get(t.id) ?? 0;
    if (cap <= 0 || remaining <= 0) {
      tierUse.set(t.id, 0);
      continue;
    }
    const used = Math.min(cap, remaining);
    tierUse.set(t.id, used);
    remainingCap.set(t.id, cap - used);
    remaining -= used;
    totalUsed += used;
  }
  for (const t of tiers) if (!tierUse.has(t.id)) tierUse.set(t.id, 0);
  return { used: totalUsed, tierUse };
}

export function computeScenario(inp: ScalingInputs): ScalingOutput {
  const monthlyRetainerRevenue = inp.retainers.reduce((a, r) => a + r.monthlyRevenue, 0);
  const totalRevenue = inp.monthlyProjectRevenue + monthlyRetainerRevenue;
  const projHourly = Math.max(1, inp.projectHourlyRate);

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

  const projectHoursNeeded = inp.monthlyProjectRevenue / projHourly;
  const retainerHoursNeeded = inp.retainers.reduce((a, r) => a + r.supportHoursPerMonth, 0);

  const salariedCapacityHours = inp.salariedEngineers.reduce(
    (a, t) => a + t.count * t.hoursPerMonth,
    0,
  );
  const commissionCapacityHours = inp.commissionOnlyEngineers.reduce(
    (a, t) => a + t.count * t.hoursPerMonth,
    0,
  );

  const salRemaining = new Map<string, number>(
    inp.salariedEngineers.map((t) => [t.id, t.count * t.hoursPerMonth]),
  );
  const comRemaining = new Map<string, number>(
    inp.commissionOnlyEngineers.map((t) => [t.id, t.count * t.hoursPerMonth]),
  );

  const salRetainerEligible = inp.salariedEngineers.filter((t) => t.worksOnRetainers);
  const comRetainerEligible = inp.commissionOnlyEngineers.filter((t) => t.worksOnRetainers);
  const salProjectEligible = inp.salariedEngineers.filter((t) => t.worksOnProjects);
  const comProjectEligible = inp.commissionOnlyEngineers.filter((t) => t.worksOnProjects);

  // Per-tier reserved-hours tracking (used to display reservation segment).
  const reservedByTier = new Map<string, number>();
  const addReserved = (id: string, n: number) =>
    reservedByTier.set(id, (reservedByTier.get(id) ?? 0) + n);

  // ----- Retainer pass with reservations -----
  // Track each tier's remaining manual retainer allocation across the retainer loop.
  const remainingManualRet = new Map<string, number>();
  for (const t of inp.salariedEngineers)
    remainingManualRet.set(t.id, Math.max(0, t.manualRetainerHours ?? 0));
  for (const t of inp.commissionOnlyEngineers)
    remainingManualRet.set(t.id, Math.max(0, t.manualRetainerHours ?? 0));

  const tierRetainerHours = new Map<string, number>();
  const tierRetainerRevenue = new Map<string, number>();
  const tierRetainerCommBase = new Map<string, number>();
  const retainerCoverage: RetainerCoverage[] = [];
  let unmetRetainerHours = 0;

  const drainManual = (
    tiers: EngineerTier[],
    need: number,
    use: Map<string, number>,
  ): number => {
    let remaining = need;
    let used = 0;
    for (const t of tiers) {
      if (remaining <= 0) break;
      const manualLeft = remainingManualRet.get(t.id) ?? 0;
      const isSal = inp.salariedEngineers.some((x) => x.id === t.id);
      const capMap = isSal ? salRemaining : comRemaining;
      const cap = capMap.get(t.id) ?? 0;
      const take = Math.min(manualLeft, cap, remaining);
      if (take <= 0) continue;
      capMap.set(t.id, cap - take);
      remainingManualRet.set(t.id, manualLeft - take);
      use.set(t.id, (use.get(t.id) ?? 0) + take);
      addReserved(t.id, take);
      remaining -= take;
      used += take;
    }
    return used;
  };

  for (const r of inp.retainers) {
    const need = Math.max(0, r.supportHoursPerMonth);
    if (need <= 0) {
      retainerCoverage.push({
        id: r.id,
        label: r.label,
        hoursNeeded: 0,
        hoursCovered: 0,
        shortHours: 0,
      });
      continue;
    }

    const salUse = new Map<string, number>();
    const comUse = new Map<string, number>();

    // 1) Drain manual retainer reservations first (sal before com).
    let outstanding = need;
    outstanding -= drainManual(salRetainerEligible, outstanding, salUse);
    outstanding -= drainManual(comRetainerEligible, outstanding, comUse);

    // 2) Priority fill the remainder.
    const salFill = fillTiers(salRetainerEligible, outstanding, salRemaining);
    for (const [id, h] of salFill.tierUse) if (h > 0) salUse.set(id, (salUse.get(id) ?? 0) + h);
    outstanding -= salFill.used;
    const comFill = fillTiers(comRetainerEligible, outstanding, comRemaining);
    for (const [id, h] of comFill.tierUse) if (h > 0) comUse.set(id, (comUse.get(id) ?? 0) + h);
    outstanding -= comFill.used;

    const covered = need - Math.max(0, outstanding);
    const short = Math.max(0, outstanding);
    unmetRetainerHours += short;

    retainerCoverage.push({
      id: r.id,
      label: r.label,
      hoursNeeded: need,
      hoursCovered: covered,
      shortHours: short,
    });

    const accumulate = (use: Map<string, number>) => {
      for (const [tid, h] of use) {
        if (h <= 0) continue;
        const share = covered > 0 ? h / covered : 0;
        const rev = share * r.monthlyRevenue;
        tierRetainerHours.set(tid, (tierRetainerHours.get(tid) ?? 0) + h);
        tierRetainerRevenue.set(tid, (tierRetainerRevenue.get(tid) ?? 0) + rev);
        if (r.appliesToCommission) {
          tierRetainerCommBase.set(tid, (tierRetainerCommBase.get(tid) ?? 0) + rev);
        }
      }
    };
    accumulate(salUse);
    accumulate(comUse);
  }

  // ----- Project pass with reservations -----
  const projectReservedByTier = new Map<string, number>();
  const reserveProject = (tiers: EngineerTier[], capMap: Map<string, number>) => {
    let totalReserved = 0;
    for (const t of tiers) {
      const want = Math.max(0, t.manualProjectHours ?? 0);
      if (want <= 0) continue;
      const cap = capMap.get(t.id) ?? 0;
      const take = Math.min(want, cap);
      if (take <= 0) continue;
      capMap.set(t.id, cap - take);
      projectReservedByTier.set(t.id, (projectReservedByTier.get(t.id) ?? 0) + take);
      addReserved(t.id, take);
      totalReserved += take;
    }
    return totalReserved;
  };
  const salReservedProj = reserveProject(salProjectEligible, salRemaining);
  const comReservedProj = reserveProject(comProjectEligible, comRemaining);

  const remainingProjectDemand = Math.max(
    0,
    projectHoursNeeded - salReservedProj - comReservedProj,
  );
  const salProj = fillTiers(salProjectEligible, remainingProjectDemand, salRemaining);
  const remainingAfterSalaried = Math.max(0, remainingProjectDemand - salProj.used);
  const comProj = fillTiers(comProjectEligible, remainingAfterSalaried, comRemaining);

  // Merge reserved + priority-filled project hours per tier.
  const salProjFinal = new Map<string, number>(salProj.tierUse);
  for (const [id, h] of projectReservedByTier) {
    if (inp.salariedEngineers.some((t) => t.id === id))
      salProjFinal.set(id, (salProjFinal.get(id) ?? 0) + h);
  }
  const comProjFinal = new Map<string, number>(comProj.tierUse);
  for (const [id, h] of projectReservedByTier) {
    if (inp.commissionOnlyEngineers.some((t) => t.id === id))
      comProjFinal.set(id, (comProjFinal.get(id) ?? 0) + h);
  }

  const projectSalHoursUsed = salProj.used + salReservedProj;
  const projectComHoursUsed = comProj.used + comReservedProj;
  const unmetProjectHours = Math.max(
    0,
    projectHoursNeeded - projectSalHoursUsed - projectComHoursUsed,
  );

  // Build per-tier breakdown + commissions.
  const tierBreakdown: TierBreakdown[] = [];
  let cSalEng = 0;
  let cCommEng = 0;

  const buildTier = (
    t: EngineerTier,
    kind: "salaried" | "commission",
    projUse: Map<string, number>,
  ) => {
    const projHours = projUse.get(t.id) ?? 0;
    const retHours = tierRetainerHours.get(t.id) ?? 0;
    const projectRev = projHours * projHourly;
    const retainerRev = tierRetainerRevenue.get(t.id) ?? 0;
    const retainerCommBase = tierRetainerCommBase.get(t.id) ?? 0;
    const retainerBaseForTier = t.retainerCommission ? retainerCommBase : 0;
    const comm = (projectRev + retainerBaseForTier) * t.commissionRate;
    if (kind === "salaried") cSalEng += comm;
    else cCommEng += comm;

    const cap = t.count * t.hoursPerMonth;
    const used = projHours + retHours;
    tierBreakdown.push({
      id: t.id,
      label: t.label || (kind === "salaried" ? "Salaried tier" : "Commission tier"),
      kind,
      capacityHours: cap,
      usedHours: used,
      retainerHours: retHours,
      projectHours: projHours,
      reservedHours: reservedByTier.get(t.id) ?? 0,
      utilizationPct: cap > 0 ? used / cap : 0,
      revenue: projectRev + retainerRev,
      commission: comm,
      salary: t.count * t.monthlySalary,
    });
  };

  for (const t of inp.salariedEngineers) buildTier(t, "salaried", salProjFinal);
  for (const t of inp.commissionOnlyEngineers) buildTier(t, "commission", comProjFinal);

  // Sales commission split: projects vs retainers.
  const retainerSalesBase = inp.retainers
    .filter((r) => r.paySalesCommission)
    .reduce((a, r) => a + r.monthlyRevenue, 0);
  const cClientSolProjects =
    inp.clientSolutions.count > 0
      ? inp.monthlyProjectRevenue * (inp.clientSolutions.projectCommissionRate ?? 0)
      : 0;
  const cClientSolRetainers =
    inp.clientSolutions.count > 0
      ? retainerSalesBase * (inp.clientSolutions.retainerCommissionRate ?? 0)
      : 0;
  const cClientSol = cClientSolProjects + cClientSolRetainers;

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

  const totalSalHoursUsed = inp.salariedEngineers.reduce(
    (a, t) => a + (tierRetainerHours.get(t.id) ?? 0) + (salProjFinal.get(t.id) ?? 0),
    0,
  );
  const totalComHoursUsed = inp.commissionOnlyEngineers.reduce(
    (a, t) => a + (tierRetainerHours.get(t.id) ?? 0) + (comProjFinal.get(t.id) ?? 0),
    0,
  );

  const unmetHours = unmetRetainerHours + unmetProjectHours;

  const salProjOpen = inp.salariedEngineers.filter(
    (t) => t.worksOnProjects && (salRemaining.get(t.id) ?? 0) > 0,
  );
  const comProjOpen = inp.commissionOnlyEngineers.filter(
    (t) => t.worksOnProjects && (comRemaining.get(t.id) ?? 0) > 0,
  );
  const marginalEngineerRate =
    salProjOpen.length > 0
      ? salProjOpen[0].commissionRate
      : comProjOpen.length > 0
        ? comProjOpen[0].commissionRate
        : COMMISSION_ONLY_ENGINEER_COMMISSION;
  const marginalSalesRate =
    inp.clientSolutions.count > 0 ? inp.clientSolutions.projectCommissionRate ?? 0 : 0;
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

  const anyRetainerEligible =
    inp.salariedEngineers.some((t) => t.worksOnRetainers) ||
    inp.commissionOnlyEngineers.some((t) => t.worksOnRetainers);
  let hiring: HiringSignal;
  if (unmetRetainerHours > 0.5) {
    const need = Math.ceil(unmetRetainerHours / DEFAULT_HOURS_PER_MONTH);
    const msg = !anyRetainerEligible
      ? `No engineer tier is eligible for retainers — enable one or hire a dedicated retainer engineer (~${need}).`
      : `Retainers under-served by ~${Math.round(unmetRetainerHours)} hrs/mo — hire a dedicated retainer/logistics engineer (~${need}).`;
    hiring = {
      kind: "hire",
      message: msg,
      salariedNeeded: need,
      commissionNeeded: need,
      unmetHours: unmetRetainerHours,
      reason: "retainer",
    };
  } else if (unmetProjectHours > 0.5) {
    const need = Math.ceil(unmetProjectHours / DEFAULT_HOURS_PER_MONTH);
    const anyProjEligible =
      inp.salariedEngineers.some((t) => t.worksOnProjects) ||
      inp.commissionOnlyEngineers.some((t) => t.worksOnProjects);
    const msg = !anyProjEligible
      ? `No engineer tier is eligible for projects — enable one or hire ${need} engineer(s).`
      : `Need ~${Math.round(unmetProjectHours)} more project hrs/mo — hire ${need} salaried or ${need} commission-only engineer(s).`;
    hiring = {
      kind: "hire",
      message: msg,
      salariedNeeded: need,
      commissionNeeded: need,
      unmetHours: unmetProjectHours,
      reason: "project",
    };
  } else {
    const totalCap = salariedCapacityHours + commissionCapacityHours;
    const util = totalCap > 0 ? (totalSalHoursUsed + totalComHoursUsed) / totalCap : 0;
    if (util > 0.85) {
      hiring = {
        kind: "warn",
        message: `Roster running hot (${Math.round(util * 100)}% utilized) — plan next hire.`,
      };
    } else {
      hiring = { kind: "healthy", message: `Capacity healthy (${Math.round(util * 100)}% utilized).` };
    }
  }

  return {
    totalRevenue,
    monthlyRetainerRevenue,
    fixedSalaries,
    commissions: {
      salariedEngineers: cSalEng,
      commissionOnlyEngineers: cCommEng,
      clientSolutions: cClientSol,
      clientSolutionsProjects: cClientSolProjects,
      clientSolutionsRetainers: cClientSolRetainers,
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
    retainerHoursNeeded,
    salariedCapacityHours,
    commissionCapacityHours,
    salariedHoursUsed: totalSalHoursUsed,
    commissionHoursUsed: totalComHoursUsed,
    unmetProjectHours,
    unmetRetainerHours,
    unmetHours,
    tierBreakdown,
    retainerCoverage,
    hiring,
  };
}

function newId(prefix = "t"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function makeTier(
  partial: Partial<EngineerTier> & { kind?: "salaried" | "commission" },
): EngineerTier {
  const isSal = partial.kind === "salaried";
  const legacyRetainerComm = partial.appliesTo === "projects+retainers";
  return {
    id: partial.id ?? newId("t"),
    label: partial.label ?? (isSal ? "Salaried tier" : "Commission tier"),
    count: partial.count ?? 1,
    monthlySalary: partial.monthlySalary ?? (isSal ? 8000 : 0),
    commissionRate:
      partial.commissionRate ??
      (isSal ? SALARIED_ENGINEER_COMMISSION : COMMISSION_ONLY_ENGINEER_COMMISSION),
    hoursPerMonth: partial.hoursPerMonth ?? DEFAULT_HOURS_PER_MONTH,
    worksOnProjects: partial.worksOnProjects ?? true,
    worksOnRetainers: partial.worksOnRetainers ?? true,
    retainerCommission: partial.retainerCommission ?? legacyRetainerComm,
    manualProjectHours: Math.max(0, partial.manualProjectHours ?? 0),
    manualRetainerHours: Math.max(0, partial.manualRetainerHours ?? 0),
  };
}

export function makeRetainer(partial: Partial<Retainer> = {}): Retainer {
  return {
    id: partial.id ?? newId("r"),
    label: partial.label ?? "New retainer",
    monthlyRevenue: partial.monthlyRevenue ?? 3000,
    supportHoursPerMonth: partial.supportHoursPerMonth ?? 20,
    appliesToCommission: partial.appliesToCommission ?? false,
    paySalesCommission: partial.paySalesCommission ?? true,
  };
}

function normalizeSales(raw: unknown): SalesRole {
  const r = (raw ?? {}) as Partial<SalesRole>;
  const legacyRate = r.commissionRate;
  return {
    count: r.count ?? 0,
    monthlySalary: r.monthlySalary ?? 0,
    projectCommissionRate:
      r.projectCommissionRate ?? legacyRate ?? CLIENT_SOLUTIONS_PROJECT_COMMISSION,
    retainerCommissionRate:
      r.retainerCommissionRate ??
      (r.appliesTo === "projects+retainers"
        ? legacyRate ?? CLIENT_SOLUTIONS_RETAINER_COMMISSION
        : CLIENT_SOLUTIONS_RETAINER_COMMISSION),
  };
}

export function defaultInputs(seed: {
  monthlyRevenue: number;
  founderOwnership: number;
  desiredMonthlyNet: number;
  payrollTaxRate: number;
}): ScalingInputs {
  const project = Math.round(seed.monthlyRevenue * 0.8);
  const retainer = Math.round(seed.monthlyRevenue * 0.2);
  return {
    v: 3,
    monthlyProjectRevenue: project,
    projectHourlyRate: DEFAULT_PROJECT_HOURLY_RATE,
    retainers:
      retainer > 0
        ? [
            makeRetainer({
              label: "Existing retainers",
              monthlyRevenue: retainer,
              supportHoursPerMonth: 30,
            }),
          ]
        : [],
    salariedEngineers: [makeTier({ kind: "salaried", label: "Senior salaried", count: 1 })],
    commissionOnlyEngineers: [
      makeTier({ kind: "commission", label: "Contractor pool", count: 2 }),
    ],
    clientSolutions: {
      count: 1,
      monthlySalary: 6000,
      projectCommissionRate: CLIENT_SOLUTIONS_PROJECT_COMMISSION,
      retainerCommissionRate: CLIENT_SOLUTIONS_RETAINER_COMMISSION,
    },
    otherFixed: { count: 0, monthlySalary: 0 },
    overhead: 1000,
    targetMarginPct: 0.4,
    founderOwnership: seed.founderOwnership,
    desiredMonthlyNet: seed.desiredMonthlyNet,
    employerPayrollTaxRate: seed.payrollTaxRate,
  };
}

function normalizeTier(raw: unknown, kind: "salaried" | "commission"): EngineerTier {
  const t = (raw ?? {}) as Partial<EngineerTier> & { appliesTo?: CommissionBase };
  return makeTier({ ...t, kind });
}

function normalizeRetainer(raw: unknown): Retainer {
  const r = (raw ?? {}) as Partial<Retainer>;
  return makeRetainer(r);
}

export function migrateInputs(raw: unknown): ScalingInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (r.v === 3 && Array.isArray(r.retainers)) {
    const inp = r as unknown as ScalingInputs;
    return {
      ...inp,
      retainers: (inp.retainers ?? []).map(normalizeRetainer),
      salariedEngineers: (inp.salariedEngineers ?? []).map((t) => normalizeTier(t, "salaried")),
      commissionOnlyEngineers: (inp.commissionOnlyEngineers ?? []).map((t) =>
        normalizeTier(t, "commission"),
      ),
      clientSolutions: normalizeSales(inp.clientSolutions),
    };
  }

  if (
    r.v === 2 &&
    Array.isArray(r.salariedEngineers) &&
    Array.isArray(r.commissionOnlyEngineers)
  ) {
    const retainerRev = Number(r.monthlyRetainerRevenue) || 0;
    const rate = Number(r.revenueHourlyRate) || DEFAULT_PROJECT_HOURLY_RATE;
    return {
      v: 3,
      monthlyProjectRevenue: Number(r.monthlyProjectRevenue) || 0,
      projectHourlyRate: rate,
      retainers:
        retainerRev > 0
          ? [
              makeRetainer({
                label: "Existing retainers",
                monthlyRevenue: retainerRev,
                supportHoursPerMonth: Math.max(10, Math.round(retainerRev / rate)),
              }),
            ]
          : [],
      salariedEngineers: (r.salariedEngineers as unknown[]).map((t) => normalizeTier(t, "salaried")),
      commissionOnlyEngineers: (r.commissionOnlyEngineers as unknown[]).map((t) =>
        normalizeTier(t, "commission"),
      ),
      clientSolutions: normalizeSales(r.clientSolutions),
      otherFixed: (r.otherFixed as ScalingInputs["otherFixed"]) ?? { count: 0, monthlySalary: 0 },
      overhead: Number(r.overhead) || 0,
      targetMarginPct: Number(r.targetMarginPct) || 0.4,
      founderOwnership: Number(r.founderOwnership) || 0.6,
      desiredMonthlyNet: Number(r.desiredMonthlyNet) || 0,
      employerPayrollTaxRate: Number(r.employerPayrollTaxRate) || 0.0765,
    };
  }

  try {
    const salRole = r.salariedEngineers as
      | { count: number; monthlySalary: number; commissionRate: number; appliesTo: CommissionBase }
      | undefined;
    const comRole = r.commissionOnlyEngineers as
      | { count: number; monthlySalary: number; commissionRate: number; appliesTo: CommissionBase }
      | undefined;
    if (!salRole || !comRole) return null;
    const retainerRev = Number(r.monthlyRetainerRevenue) || 0;
    return {
      v: 3,
      monthlyProjectRevenue: Number(r.monthlyProjectRevenue) || 0,
      projectHourlyRate: DEFAULT_PROJECT_HOURLY_RATE,
      retainers:
        retainerRev > 0
          ? [
              makeRetainer({
                label: "Existing retainers",
                monthlyRevenue: retainerRev,
                supportHoursPerMonth: Math.max(
                  10,
                  Math.round(retainerRev / DEFAULT_PROJECT_HOURLY_RATE),
                ),
              }),
            ]
          : [],
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
      clientSolutions: normalizeSales(r.clientSolutions),
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

// ===== Scaling curve =====
// Sweep project revenue from current → current * maxMultiplier in `steps` points.
// Optionally scale retainer revenue proportionally and auto-propose hires.

export function fteFromHours(hours: number, hoursPerMonth = DEFAULT_HOURS_PER_MONTH): number {
  return hoursPerMonth > 0 ? hours / hoursPerMonth : 0;
}

export type TierHire = {
  tierId: string;
  kind: "salaried" | "commission";
  delta: number; // +N hires, or -N for converted-out
  reason: string;
};

export type HireProposal = {
  addSalaried: number;
  addCommission: number;
  convertCommissionToSalaried: number;
  detail: string[];
  tierHires: TierHire[];
};

function bumpTier(
  inp: ScalingInputs,
  tierId: string,
  kind: "salaried" | "commission",
  delta: number,
): ScalingInputs {
  if (kind === "salaried") {
    return {
      ...inp,
      salariedEngineers: inp.salariedEngineers.map((t) =>
        t.id === tierId ? { ...t, count: Math.max(0, t.count + delta) } : t,
      ),
    };
  }
  return {
    ...inp,
    commissionOnlyEngineers: inp.commissionOnlyEngineers.map((t) =>
      t.id === tierId ? { ...t, count: Math.max(0, t.count + delta) } : t,
    ),
  };
}

export function proposeRoster(inputs: ScalingInputs): {
  inputs: ScalingInputs;
  proposal: HireProposal;
  output: ScalingOutput;
} {
  let current = inputs;
  let out = computeScenario(current);
  const proposal: HireProposal = {
    addSalaried: 0,
    addCommission: 0,
    convertCommissionToSalaried: 0,
    detail: [],
    tierHires: [],
  };

  const recordHire = (tierId: string, kind: "salaried" | "commission", delta: number, reason: string) => {
    const existing = proposal.tierHires.find((h) => h.tierId === tierId && h.kind === kind);
    if (existing) existing.delta += delta;
    else proposal.tierHires.push({ tierId, kind, delta, reason });
  };

  // 1) Cover unmet demand.
  for (let i = 0; i < 12 && out.unmetHours > 0.5; i++) {
    const needsRetainer = out.unmetRetainerHours > 0.5;
    const eligible = (t: EngineerTier) =>
      needsRetainer ? t.worksOnRetainers : t.worksOnProjects;
    const salTier = current.salariedEngineers.find(eligible);
    let hired = false;

    if (salTier) {
      const trial = bumpTier(current, salTier.id, "salaried", 1);
      const trialOut = computeScenario(trial);
      if (trialOut.netMarginPct >= current.targetMarginPct) {
        current = trial;
        out = trialOut;
        proposal.addSalaried += 1;
        proposal.detail.push(`+1 salaried (${salTier.label})`);
        recordHire(salTier.id, "salaried", 1, `Covers ${needsRetainer ? "retainer" : "project"} shortfall; margin stays ≥ target.`);
        hired = true;
      }
    }
    if (!hired) {
      const comTier = current.commissionOnlyEngineers.find(eligible);
      if (comTier) {
        current = bumpTier(current, comTier.id, "commission", 1);
        out = computeScenario(current);
        proposal.addCommission += 1;
        proposal.detail.push(`+1 commission (${comTier.label})`);
        recordHire(comTier.id, "commission", 1, `Salaried hire would push margin below target; contractor keeps margin healthy.`);
      } else if (salTier) {
        current = bumpTier(current, salTier.id, "salaried", 1);
        out = computeScenario(current);
        proposal.addSalaried += 1;
        proposal.detail.push(`+1 salaried (${salTier.label}, margin tight)`);
        recordHire(salTier.id, "salaried", 1, `No commission-only tier available; salaried hire needed despite tight margin.`);
      } else {
        break;
      }
    }
  }

  // 2) Convert commission → salaried when we're well above target margin.
  for (let i = 0; i < 6; i++) {
    if (out.netMarginPct < current.targetMarginPct + 0.10) break;
    const comTier = current.commissionOnlyEngineers.find((t) => t.count >= 1);
    const salTier = current.salariedEngineers[0];
    if (!comTier || !salTier) break;
    const trial = bumpTier(
      bumpTier(current, comTier.id, "commission", -1),
      salTier.id,
      "salaried",
      1,
    );
    const trialOut = computeScenario(trial);
    if (trialOut.netMarginPct < current.targetMarginPct) break;
    current = trial;
    out = trialOut;
    proposal.convertCommissionToSalaried += 1;
    proposal.detail.push(`convert 1 commission → salaried (${salTier.label})`);
    recordHire(comTier.id, "commission", -1, `Margin ≥ target + 10%; convert to salaried to lock capacity at lower marginal cost.`);
    recordHire(salTier.id, "salaried", 1, `Converted from ${comTier.label}.`);
  }

  return { inputs: current, proposal, output: out };
}

export type ScalingCurvePoint = {
  projectRevenue: number;
  retainerRevenue: number;
  totalRevenue: number;
  marginPct: number;
  demandHours: number;
  projectHours: number;
  retainerHours: number;
  capacityHours: number;
  shortHours: number;
  founderNetMonthly: number;
  hiring: HiringSignal;
  fteDemand: number;
  fteCapacity: number;
  proposal: HireProposal;
  proposedFteCapacity: number;
  proposedMarginPct: number;
  proposedFounderNetMonthly: number;
  proposedShortHours: number;
};

export function computeScalingCurve(
  inputs: ScalingInputs,
  opts: {
    steps?: number;
    maxMultiplier?: number;
    scaleRetainers?: boolean;
    autoHire?: boolean;
  } = {},
): ScalingCurvePoint[] {
  const steps = Math.max(2, opts.steps ?? 12);
  const maxMult = Math.max(1, opts.maxMultiplier ?? 3);
  const scaleRetainers = !!opts.scaleRetainers;
  const autoHire = opts.autoHire !== false;
  const baseProject = Math.max(1, inputs.monthlyProjectRevenue);

  const points: ScalingCurvePoint[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const projMult = 1 + t * (maxMult - 1);
    const newProject = baseProject * projMult;
    const retMult = scaleRetainers ? projMult : 1;
    const newRetainers = inputs.retainers.map((r) => ({
      ...r,
      monthlyRevenue: r.monthlyRevenue * retMult,
      supportHoursPerMonth: r.supportHoursPerMonth * retMult,
    }));
    const stepInputs: ScalingInputs = {
      ...inputs,
      monthlyProjectRevenue: newProject,
      retainers: newRetainers,
    };
    const base = computeScenario(stepInputs);
    const baseCap = base.salariedCapacityHours + base.commissionCapacityHours;
    const demand = base.projectHoursNeeded + base.retainerHoursNeeded;

    let proposal: HireProposal = {
      addSalaried: 0,
      addCommission: 0,
      convertCommissionToSalaried: 0,
      detail: [],
      tierHires: [],
    };
    let post = base;
    if (autoHire) {
      const r = proposeRoster(stepInputs);
      proposal = r.proposal;
      post = r.output;
    }
    const postCap = post.salariedCapacityHours + post.commissionCapacityHours;

    points.push({
      projectRevenue: newProject,
      retainerRevenue: base.monthlyRetainerRevenue,
      totalRevenue: base.totalRevenue,
      marginPct: base.netMarginPct,
      demandHours: demand,
      projectHours: base.projectHoursNeeded,
      retainerHours: base.retainerHoursNeeded,
      capacityHours: baseCap,
      shortHours: base.unmetHours,
      founderNetMonthly: base.founderNetMonthly,
      hiring: base.hiring,
      fteDemand: fteFromHours(demand),
      fteCapacity: fteFromHours(baseCap),
      proposal,
      proposedFteCapacity: fteFromHours(postCap),
      proposedMarginPct: post.netMarginPct,
      proposedFounderNetMonthly: post.founderNetMonthly,
      proposedShortHours: post.unmetHours,
    });
  }
  return points;
}

