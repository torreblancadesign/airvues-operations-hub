import test from "node:test";
import assert from "node:assert/strict";

import {
  findByEmail,
  normalizeEmail,
  readinessOf,
  sortContacts,
  validateContact,
} from "../lib/retainer-contact-rules";
import type { RetainerContact } from "../lib/retainer-types";

function c(over: Partial<RetainerContact> & { id: string; name: string }): RetainerContact {
  return {
    firstName: null,
    lastName: null,
    email: "someone@example.com",
    companyId: "co1",
    portalAccess: false,
    portalRole: null,
    portalLastLogin: null,
    portalInvitedAt: null,
    ...over,
  };
}

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Flavio@GracieBarra.com "), "flavio@graciebarra.com");
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
});

test("findByEmail matches regardless of case and surrounding space", () => {
  const people = [c({ id: "p1", name: "Flavio", email: "flavio@graciebarra.com" })];
  assert.equal(findByEmail(people, " FLAVIO@graciebarra.com ")?.id, "p1");
});

test("findByEmail returns null for an unknown address", () => {
  const people = [c({ id: "p1", name: "Flavio", email: "flavio@graciebarra.com" })];
  assert.equal(findByEmail(people, "nobody@example.com"), null);
});

test("findByEmail never matches on an empty address", () => {
  // Two records with no email must not collapse into each other.
  const people = [c({ id: "p1", name: "No Email", email: null })];
  assert.equal(findByEmail(people, ""), null);
  assert.equal(findByEmail(people, "   "), null);
});

test("readinessOf reports a contact with no email as broken, not merely without access", () => {
  assert.equal(readinessOf(c({ id: "a", name: "A", email: null, portalAccess: true })), "no-email");
  assert.equal(readinessOf(c({ id: "b", name: "B", email: "", portalAccess: true })), "no-email");
});

test("readinessOf distinguishes never-signed-in from active", () => {
  assert.equal(readinessOf(c({ id: "a", name: "A", portalAccess: true })), "invited");
  assert.equal(
    readinessOf(c({ id: "b", name: "B", portalAccess: true, portalLastLogin: "2026-08-01T00:00:00Z" })),
    "active",
  );
});

test("readinessOf reports no-access when the box is unchecked", () => {
  assert.equal(readinessOf(c({ id: "a", name: "A", portalAccess: false })), "no-access");
});

test("sortContacts puts owners first, then who can sign in, then alphabetical", () => {
  const rows = [
    c({ id: "d", name: "Zoe Member", portalAccess: true }),
    c({ id: "c", name: "Broken", email: null }),
    c({ id: "b", name: "Owner Two", portalRole: "Owner", portalAccess: true }),
    c({ id: "a", name: "Anna Member", portalAccess: true }),
  ];
  assert.deepEqual(
    sortContacts(rows).map((r) => r.id),
    ["b", "a", "d", "c"],
  );
});

test("sortContacts does not mutate its input", () => {
  const rows = [c({ id: "z", name: "Z" }), c({ id: "a", name: "A" })];
  const before = rows.map((r) => r.id);
  sortContacts(rows);
  assert.deepEqual(rows.map((r) => r.id), before);
});

test("validateContact requires a first name and an email", () => {
  assert.match(String(validateContact({ firstName: " ", lastName: "X", email: "a@b.co" })), /first name/i);
  assert.match(String(validateContact({ firstName: "A", lastName: "", email: "  " })), /email/i);
});

test("validateContact rejects an obviously malformed email", () => {
  assert.match(String(validateContact({ firstName: "A", lastName: "B", email: "nope" })), /valid/i);
});

test("validateContact accepts a contact with no last name", () => {
  assert.equal(validateContact({ firstName: "Cher", lastName: "", email: "cher@example.com" }), null);
});

// ---------- appendHistory ----------

import { appendHistory } from "../lib/retainer-contact-rules";

const AT = new Date("2026-08-08T14:30:00.000Z");

test("appendHistory writes a dated line naming the actor", () => {
  const out = appendHistory(null, { at: AT, actor: "david@airvues.com", action: "Portal access granted" });
  assert.equal(out, "2026-08-08 14:30 · Portal access granted · by david@airvues.com");
});

test("appendHistory includes the detail when given", () => {
  const out = appendHistory("", {
    at: AT,
    actor: "david@airvues.com",
    action: "Detached from Gracie Barra",
    detail: "left the company",
  });
  assert.match(out, /Detached from Gracie Barra — left the company · by david@airvues\.com/);
});

test("appendHistory puts the newest entry first and keeps the old ones", () => {
  const first = appendHistory(null, { at: AT, actor: "a@x.com", action: "Contact added" });
  const second = appendHistory(first, {
    at: new Date("2026-08-09T09:00:00.000Z"),
    actor: "b@x.com",
    action: "Portal access revoked",
  });
  const lines = second.split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /revoked/);
  assert.match(lines[1], /Contact added/);
});

test("appendHistory records an unknown actor rather than dropping the entry", () => {
  const out = appendHistory(null, { at: AT, actor: null, action: "Portal access granted" });
  assert.match(out, /by unknown$/);
  const blank = appendHistory(null, { at: AT, actor: "   ", action: "X" });
  assert.match(blank, /by unknown$/);
});

test("appendHistory drops the OLDEST entries when the field would overflow", () => {
  // One line well under the cap, repeated past it.
  let history = "";
  for (let i = 0; i < 500; i++) {
    history = appendHistory(history, {
      at: AT,
      actor: "a@x.com",
      action: `Event ${i} ${"padding".repeat(10)}`,
    });
  }
  assert.ok(history.length <= 20_000);
  // The most recent write survived; the first one did not.
  assert.match(history.split("\n")[0], /Event 499/);
  assert.equal(history.includes("Event 0 "), false);
});

test("appendHistory never leaves a half-truncated line", () => {
  let history = "";
  for (let i = 0; i < 400; i++) {
    history = appendHistory(history, { at: AT, actor: "a@x.com", action: `E${i} ${"x".repeat(80)}` });
  }
  for (const line of history.split("\n")) {
    assert.match(line, /· by a@x\.com$/);
  }
});
