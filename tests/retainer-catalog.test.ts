import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_TIER_CHOICES,
  legacyTierChoiceFor,
  plansAvailableFor,
  validatePlanInput,
} from "../lib/retainer-catalog";
import type { RetainerTier } from "../lib/retainer-types";

const ACME = "recAcme00000000001";
const OTHER = "recOther0000000001";

function tier(over: Partial<RetainerTier> & { id: string; name: string }): RetainerTier {
  return {
    rank: 1,
    active: true,
    includedHours: null,
    monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    slaLabel: null,
    maxUrgentPerMonth: null,
    clientDescription: null,
    custom: false,
    customForCompanyId: null,
    ...over,
  };
}

const bronze = tier({ id: "recB", name: "Bronze", rank: 1 });
const gold = tier({ id: "recG", name: "Gold", rank: 3 });
const retired = tier({ id: "recR", name: "Retired", rank: 2, active: false });
const acmeCustom = tier({
  id: "recAC", name: "Acme — Custom", rank: 50, custom: true, customForCompanyId: ACME,
});
const otherCustom = tier({
  id: "recOC", name: "Other — Custom", rank: 51, custom: true, customForCompanyId: OTHER,
});
const orphanCustom = tier({ id: "recXC", name: "Orphan — Custom", rank: 52, custom: true });
const inactiveCustom = tier({
  id: "recIC", name: "Acme — Old", rank: 53, custom: true, customForCompanyId: ACME, active: false,
});

const ALL = [bronze, gold, retired, acmeCustom, otherCustom, orphanCustom, inactiveCustom];

test("plansAvailableFor returns active catalog plans by rank", () => {
  assert.deepEqual(
    plansAvailableFor([gold, bronze], null).map((t) => t.name),
    ["Bronze", "Gold"],
  );
});

test("plansAvailableFor appends this company's custom plans after the catalog", () => {
  assert.deepEqual(
    plansAvailableFor(ALL, ACME).map((t) => t.name),
    ["Bronze", "Gold", "Acme — Custom"],
  );
});

test("plansAvailableFor excludes another company's custom plans", () => {
  assert.equal(
    plansAvailableFor(ALL, ACME).some((t) => t.id === otherCustom.id),
    false,
  );
});

test("plansAvailableFor hides a custom plan with no owning company from everyone", () => {
  assert.equal(plansAvailableFor(ALL, ACME).some((t) => t.id === orphanCustom.id), false);
  assert.equal(plansAvailableFor(ALL, OTHER).some((t) => t.id === orphanCustom.id), false);
  assert.equal(plansAvailableFor(ALL, null).some((t) => t.id === orphanCustom.id), false);
});

test("plansAvailableFor excludes inactive plans, catalog and custom alike", () => {
  const names = plansAvailableFor(ALL, ACME).map((t) => t.name);
  assert.equal(names.includes("Retired"), false);
  assert.equal(names.includes("Acme — Old"), false);
});

test("plansAvailableFor returns catalog only when companyId is null", () => {
  assert.deepEqual(plansAvailableFor(ALL, null).map((t) => t.name), ["Bronze", "Gold"]);
});

test("legacyTierChoiceFor matches each of the seven catalog names", () => {
  for (const name of LEGACY_TIER_CHOICES) {
    assert.equal(legacyTierChoiceFor(name), name);
  }
  assert.equal(LEGACY_TIER_CHOICES.length, 7);
});

test("legacyTierChoiceFor is case-exact and trims surrounding space", () => {
  assert.equal(legacyTierChoiceFor(" Gold "), "Gold");
  assert.equal(legacyTierChoiceFor("gold"), null);
});

test("legacyTierChoiceFor returns null for a custom plan name", () => {
  assert.equal(legacyTierChoiceFor("Acme — Custom"), null);
  assert.equal(legacyTierChoiceFor(""), null);
});

test("validatePlanInput accepts a valid catalog plan", () => {
  assert.equal(
    validatePlanInput({
      name: "Gold", rank: 3, includedHours: 20, monthlyRate: 3000,
      slaHours: { Urgent: 2, High: 4, Medium: 8, Low: 16 },
      custom: false, customForCompanyId: null,
    }),
    null,
  );
});

test("validatePlanInput accepts a valid custom plan", () => {
  assert.equal(
    validatePlanInput({
      name: "Acme — Custom", rank: 50, includedHours: 60, monthlyRate: 8500,
      slaHours: { Urgent: 1, High: 2, Medium: 4, Low: 8 },
      custom: true, customForCompanyId: ACME,
    }),
    null,
  );
});

test("validatePlanInput rejects a blank name", () => {
  const err = validatePlanInput({
    name: "   ", rank: 1, includedHours: null, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: false, customForCompanyId: null,
  });
  assert.match(String(err), /name/i);
});

test("validatePlanInput rejects negative money, hours, and SLA values", () => {
  const base = {
    name: "X", rank: 1, includedHours: null, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: false, customForCompanyId: null,
  };
  assert.match(String(validatePlanInput({ ...base, monthlyRate: -1 })), /rate/i);
  assert.match(String(validatePlanInput({ ...base, includedHours: -1 })), /hours/i);
  assert.match(
    String(validatePlanInput({ ...base, slaHours: { Urgent: -2, High: null, Medium: null, Low: null } })),
    /SLA/i,
  );
});

test("validatePlanInput rejects a non-finite number", () => {
  const err = validatePlanInput({
    name: "X", rank: 1, includedHours: Number.NaN, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: false, customForCompanyId: null,
  });
  assert.match(String(err), /hours/i);
});

test("validatePlanInput rejects a custom plan with no company", () => {
  const err = validatePlanInput({
    name: "Acme — Custom", rank: 50, includedHours: null, monthlyRate: null,
    slaHours: { Urgent: null, High: null, Medium: null, Low: null },
    custom: true, customForCompanyId: null,
  });
  assert.match(String(err), /client|company/i);
});

test("validatePlanInput allows zero as a rate and as included hours", () => {
  assert.equal(
    validatePlanInput({
      name: "Free", rank: 0, includedHours: 0, monthlyRate: 0,
      slaHours: { Urgent: null, High: null, Medium: null, Low: null },
      custom: false, customForCompanyId: null,
    }),
    null,
  );
});
