// Pure math for the Team Scaling & Margin Simulator. No I/O.
// Safe to import from server or client.

export const SALARIED_ENGINEER_COMMISSION = 0.15;
export const COMMISSION_ONLY_ENGINEER_COMMISSION = 0.30;
// Head of Client Solutions: 10% sales + 5% blueprint = 15% (assume always blueprinting).
export const CLIENT_SOLUTIONS_COMMISSION = 0.15;

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
  worksOnProjects: boolean; // eligible to be assigned project hours
  worksOnRetainers: boolean; // eligible to be assigned retainer hours
  retainerCommission: boolean; // pay commission on retainer revenue serviced
  // Legacy — kept optional for migration only.
  appliesTo?: CommissionBase;
};

export type Retainer = {
  id: string;
  label: string;
  monthlyRevenue: number;
  supportHoursPerMonth: number;
  appliesToCommission: boolean;
};

export type SalesRole = {
  count: number;
  monthlySalary: number;
  commissionRate: number; // 0..1
  appliesTo: CommissionBase;
};

export type ScalingInputs = {
  v: 3;
  monthlyProjectRevenue: number;
  projectHourlyRate: number; // $/hr billing rate for project work

  retainers: Retainer[];

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
  retainerHours: number;
  projectHours: number;
  utilizationPct: number; // 0..1+
  revenue: number; // project + retainer revenue serviced by this tier
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

function commissionBase(applies: CommissionBase, p: number, r: number): number {
  return applies === "projects+retainers" ? p + r : p;
}

// Fill `hoursToFill` across tiers in order, respecting each tier's remaining capacity
// (passed in via `remainingCap`, which is mutated). Returns hours used per tier.
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

  // Capacity
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

  // Remaining capacity maps (mutated by fills).
  const salRemaining = new Map<string, number>(
    inp.salariedEngineers.map((t) => [t.id, t.count * t.hoursPerMonth]),
  );
  const comRemaining = new Map<string, number>(
    inp.commissionOnlyEngineers.map((t) => [t.id, t.count * t.hoursPerMonth]),
  );

  // Eligibility-filtered tier lists (preserve user-defined order = priority).
  const salRetainerEligible = inp.salariedEngineers.filter((t) => t.worksOnRetainers);
  const comRetainerEligible = inp.commissionOnlyEngineers.filter((t) => t.worksOnRetainers);
  const salProjectEligible = inp.salariedEngineers.filter((t) => t.worksOnProjects);
  const comProjectEligible = inp.commissionOnlyEngineers.filter((t) => t.worksOnProjects);

  // Pass 1: retainers per-retainer (priority: salaried → commission, eligible only).
  const tierRetainerHours = new Map<string, number>();
  const tierRetainerRevenue = new Map<string, number>();
  const tierRetainerCommBase = new Map<string, number>();
  const retainerCoverage: RetainerCoverage[] = [];
  let unmetRetainerHours = 0;

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
    const salFill = fillTiers(salRetainerEligible, need, salRemaining);
    const after = need - salFill.used;
    const comFill = fillTiers(comRetainerEligible, after, comRemaining);
    const covered = salFill.used + comFill.used;
    const short = Math.max(0, need - covered);
    unmetRetainerHours += short;

    retainerCoverage.push({
      id: r.id,
      label: r.label,
      hoursNeeded: need,
      hoursCovered: covered,
      shortHours: short,
    });

    // Distribute this retainer's revenue across tiers proportional to retainer hours they covered.
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
    accumulate(salFill.tierUse);
    accumulate(comFill.tierUse);
  }

  // Pass 2: project work fills remaining capacity (eligible only).
  const salProj = fillTiers(salProjectEligible, projectHoursNeeded, salRemaining);
  const remainingAfterSalaried = Math.max(0, projectHoursNeeded - salProj.used);
  const comProj = fillTiers(comProjectEligible, remainingAfterSalaried, comRemaining);

  const projectSalHoursUsed = salProj.used;
  const projectComHoursUsed = comProj.used;
  const unmetProjectHours = Math.max(
    0,
    projectHoursNeeded - projectSalHoursUsed - projectComHoursUsed,
  );

  // Build per-tier breakdown + commissions.
  const tierBreakdown: TierBreakdown[] = [];
  let cSalEng = 0;
  let cCommEng = 0;

  const buildTier = (t: EngineerTier, kind: "salaried" | "commission", projUse: Map<string, number>) => {
    const projHours = projUse.get(t.id) ?? 0;
    const retHours = tierRetainerHours.get(t.id) ?? 0;
    const projectRev = projHours * projHourly;
    const retainerRev = tierRetainerRevenue.get(t.id) ?? 0;
    const retainerCommBase = tierRetainerCommBase.get(t.id) ?? 0;
    // Per-tier commission: project rev always counted (if eligible); retainer rev counted when
    // BOTH the retainer opted in AND the tier opts in via `retainerCommission`.
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
      utilizationPct: cap > 0 ? used / cap : 0,
      revenue: projectRev + retainerRev,
      commission: comm,
      salary: t.count * t.monthlySalary,
    });
  };

  for (const t of inp.salariedEngineers) buildTier(t, "salaried", salProj.tierUse);
  for (const t of inp.commissionOnlyEngineers) buildTier(t, "commission", comProj.tierUse);

  const cClientSol =
    inp.clientSolutions.count > 0
      ? commissionBase(
          inp.clientSolutions.appliesTo,
          inp.monthlyProjectRevenue,
          monthlyRetainerRevenue,
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

  const totalSalHoursUsed =
    (tierRetainerHours.size
      ? Array.from(tierRetainerHours.entries()).reduce((a, [id, h]) => {
          const isSal = inp.salariedEngineers.some((t) => t.id === id);
          return a + (isSal ? h : 0);
        }, 0)
      : 0) + projectSalHoursUsed;
  const totalComHoursUsed =
    (tierRetainerHours.size
      ? Array.from(tierRetainerHours.entries()).reduce((a, [id, h]) => {
          const isCom = inp.commissionOnlyEngineers.some((t) => t.id === id);
          return a + (isCom ? h : 0);
        }, 0)
      : 0) + projectComHoursUsed;

  const unmetHours = unmetRetainerHours + unmetProjectHours;

  // Marginal rate for headroom: assume marginal $1 hits a project-eligible salaried tier first if room,
  // else a project-eligible commission-only tier.
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

  // Hiring signal — retainers first.
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
  };
}

export function makeRetainer(partial: Partial<Retainer> = {}): Retainer {
  return {
    id: partial.id ?? newId("r"),
    label: partial.label ?? "New retainer",
    monthlyRevenue: partial.monthlyRevenue ?? 3000,
    supportHoursPerMonth: partial.supportHoursPerMonth ?? 20,
    appliesToCommission: partial.appliesToCommission ?? false,
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
        ? [makeRetainer({ label: "Existing retainers", monthlyRevenue: retainer, supportHoursPerMonth: 30 })]
        : [],
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

// Migrate legacy scenario inputs to v3.
export function migrateInputs(raw: unknown): ScalingInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // Already v3
  if (r.v === 3 && Array.isArray(r.retainers)) {
    return r as unknown as ScalingInputs;
  }

  // v2 → v3
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
      salariedEngineers: r.salariedEngineers as EngineerTier[],
      commissionOnlyEngineers: r.commissionOnlyEngineers as EngineerTier[],
      clientSolutions: r.clientSolutions as SalesRole,
      otherFixed: (r.otherFixed as ScalingInputs["otherFixed"]) ?? { count: 0, monthlySalary: 0 },
      overhead: Number(r.overhead) || 0,
      targetMarginPct: Number(r.targetMarginPct) || 0.4,
      founderOwnership: Number(r.founderOwnership) || 0.6,
      desiredMonthlyNet: Number(r.desiredMonthlyNet) || 0,
      employerPayrollTaxRate: Number(r.employerPayrollTaxRate) || 0.0765,
    };
  }

  // v1 → v3
  try {
    const salRole = r.salariedEngineers as
      | { count: number; monthlySalary: number; commissionRate: number; appliesTo: CommissionBase }
      | undefined;
    const comRole = r.commissionOnlyEngineers as
      | { count: number; monthlySalary: number; commissionRate: number; appliesTo: CommissionBase }
      | undefined;
    const cs = r.clientSolutions as ScalingInputs["clientSolutions"] | undefined;
    if (!salRole || !comRole || !cs) return null;
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
