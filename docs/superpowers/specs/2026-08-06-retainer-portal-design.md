# Retainer Portal — Design

**Date:** 2026-08-06
**Status:** Approved for planning
**Author:** David Bracho + Claude

---

## 1. Problem

Airvues sells retainer agreements. Today a retainer is a `Proposal Type = "Retainer Agreement"`
row in the Airtable `⚪️ Quotes` table, and the work delivered against it is a set of `🟢 Stories`
linked to that quote. There is no way for a client to see their agreement, file a request, or
learn when it will be answered. There is no response-time commitment tracked anywhere. Ops
back-fills the stories retroactively — on the Gracie Barra retainer, stories were created
2026-08-03 carrying completion dates from late June, up to six weeks of lag.

We need three things:

1. **Clients** — a service-desk surface where multiple users from one client company sign in,
   see their agreement, file requests, and get responses inside a promised time.
2. **Developers** — visibility into requests filed against the retainers they are assigned to.
3. **Managers** — oversight across every retainer: what is open, what is late, what is at risk.

### Live data at time of writing

| Retainer | Status | Tier | Rate | Hours | Contacts |
|---|---|---|---|---|---|
| Gracie Barra | Approved and Signed, subscription Active | Platinum | $6,750/mo | 45/mo | **8** |
| North London Therapy | Project In Progress | — | — | — | 1 |
| Dr. Bronner's | Rejected | — | — | — | 1 |

Gracie Barra is the only company in the base with more than one contact, and is therefore the
real multi-user case this design must serve.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Deployment | **Separate Next.js app, separate repo, separate URL** | A client session physically cannot reach ops code |
| Ticket model | **New `Retainer Requests` table**, triaged into Stories | Keeps internal Story Status and commission automation away from clients |
| SLA definition | **Time to first human response** | Measures responsiveness, not sprint capacity |
| SLA policy storage | **`Retainer Tiers` Airtable table**, manager-owned | Renegotiation must not require a deploy |
| Working window | **9am–6pm, Mon–Fri** | 9-hour business day |
| Timezone | **`America/Los_Angeles`** (IANA, not fixed −8) | Handles PST/PDT automatically |
| Hours | **Soft target, no cap, never blocks work** | Matches how the business actually operates |
| Billing period | **Anniversary of `Retainer Effective Date`** | Stays in sync with Stripe subscription dates |
| Client auth | **NextAuth Email provider + provisioned email service** | Identity stays in Airtable People; no new auth SaaS |
| Provisioning | **Ops seeds first contact; client Owner invites colleagues** | Scales past the ops bottleneck |
| Manager view | **Cross-retainer health board** | Answers "which retainer is at risk?" |

### Scope

**v1** — all retainer clients. Agreement view · submit request · threaded comments ·
client-set priority · all four notifications.

**v1.1** — attachments · hours-consumed gauge.

**Rationale for the v1/v1.1 split.** Comments are load-bearing: the SLA is defined as time to
first human response, so without a thread there is nowhere for that response to land, the clock
can never legitimately stop, and the breach count measures nothing. Attachments are deferrable
(clients can paste links). The **hours gauge is deferred on a data-quality precondition** — see
§9 Risks.

**Deferred** — client-visible invoices, Slack notifications, self-serve signup,
per-retainer timezone overrides.

---

## 3. Architecture

Two deployments, one Airtable base.

```
airvues-operations-hub              airvues-retainer-portal          Airtable
(existing · Google OAuth)           (new · email magic link)         (app4vhhWMbRFOloOU)
├── /retainers        board       ├── /login                             │
├── /retainers/[id]   detail      ├── /              desk home           │
├── /me → your requests           ├── /requests      list             ◄──┤
└── triage request → Story        ├── /requests/[id] thread              │
                                  └── /team          invite              │
         │                                    │                          │
         └──────────── both read/write ───────┴──────────────────────────┘
```

**The portal deployment contains no ops routes and no ops mutations.** This is the security
model. It matters because `lib/authz.ts` currently states *"Edit rights are no longer gated by
role. Any signed-in user can mutate"* — every mutation in the ops app is gated by
`requireSignedIn()` alone. Had the portal shared that deployment, every existing mutation would
have needed its gate rewritten before launch. Separation removes that work entirely.

### Shared code

Duplicated deliberately into the portal repo, **not** a monorepo. Migrating a live production
app into a workspace is its own project and must not ride along on this one.

Shared surface, kept deliberately small:

- `lib/airtable.ts` — the server-only client
- `lib/schema.ts` — generated; `scripts/regenerate-schema.mjs` writes to **both** repos so it
  cannot drift
- `lib/retainer-sla.ts` — business-day engine (pure, no I/O)
- `lib/retainer-types.ts` — client-safe types

### URL

Portal gets its own domain, e.g. `portal.airvues.com`, distinct from
`airvues-ops.vercel.app`. Separate Vercel project, separate env vars, separate `AUTH_SECRET`.

---

## 4. Data model

### Built 2026-08-06 (live)

**`⚙️ Retainer Tiers`** — `tblT6U9M9EFa4lKu0`, 7 rows seeded

`Tier Name` (primary) · `Rank` · `Active` · `Included Hours` · `Monthly Rate` ·
`SLA — Urgent/High/Medium/Low (business hrs)` · `SLA Label (client-facing)` ·
`Max Urgent / Month` · `Client-facing Description`

SLA columns are blank pending management input. The number and the client-facing label are
**separate fields on purpose**: the client reads "Next business day", the engine computes
against `8`. One field cannot serve both without either breaking the math or leaking "8" to
the client.

**`🟣 Retainer Requests`** — `tblRBsPqSvzvAuSyY`

`Title` (primary) · `Retainer` → Quotes · **`Company` → Companies (tenant key)** ·
`Submitted By` → People · `Description` · `Client Priority` · `Status` · `Submitted At` ·
`SLA Due At` · `First Responded At` · `SLA Outcome` · `Assigned To` → People ·
`Stories` → Stories · `Closed At` · `Internal Notes`

`Status` is client-facing (`Submitted · Acknowledged · In Progress · Awaiting Client ·
Delivered · Closed · Declined`) and deliberately distinct from `Story Status`, whose values
(`QA Review`, `Analysis Required`, `Archived`) must never reach a client. A client-authored
record must also never trip the completion-payment automation in `lib/completion-payments.ts`.

`Submitted At` is app-set rather than `createdTime` so ops can file a request on a client's
behalf carrying its true arrival time.

**`🟣 Retainer Request Comments`** — `tblIdtmSzkerb9xUS`

`Label` (primary) · `Request` · `Author` → People · `Author Side` (Client/Airvues) · `Body` ·
`Created At` · `Visible to Client`

The portal renders only `Author Side = Client OR Visible to Client = true`. One checkbox
prevents an internal aside being published to a client, and is far cheaper now than retrofitted.

**Added to existing tables:** `Quotes.Company`, `Quotes.Retainer Tier`,
`People.Portal Access`, `People.Portal Role`, `People.Portal Last Login`,
`People.Portal Invited At`.

### The tenant key

Before this work, **no retainer quote had a `Company` link** — all three had empty
`Company Name`, `Existing Company?`, and `Form Submission`. The only path from a retainer to a
company ran `Quote → Prepared for → People → Company`: a nullable two-hop chain through one
individual. For Gracie Barra, that individual was Flavio Almeida.

That chain was about to become the tenant boundary deciding which client sees which data. A
security boundary must never be derived through a nullable path. `Quotes.Company` was added and
all three records backfilled.

**Rule: portal scoping reads `Company` directly and never derives it.** Any retainer quote
without a `Company` link is invisible to the portal by design.

### Not creatable via API

`Autonumber` and `Request Number` (formula) must be added in the Airtable UI — the Meta API
rejects `autoNumber` and `formula` with `UNSUPPORTED_FIELD_TYPE_FOR_CREATE`. Formula:
`"REQ-" & {Autonumber}`. Changing the prefix later is a formula edit, not a migration.

---

## 5. SLA engine

A pure module, no I/O, no Airtable dependency — therefore trivially testable, which matters
because it is the one component whose bugs are invisible until a client disputes a breach.

```
businessHoursBetween(start, end): number
addBusinessHours(start, hours): Date
```

Window: 09:00–18:00, Mon–Fri, `America/Los_Angeles`, minus a holiday list.

**Lifecycle**

1. **Submit** — resolve `Retainer → Retainer Tier`, read the column matching `Client Priority`,
   compute `SLA Due At = addBusinessHours(Submitted At, n)`, set `SLA Outcome = Pending`.
2. **First Airvues comment** — stamp `First Responded At`; set `SLA Outcome` to `Met` or
   `Breached`.
3. **Nightly cron** — sweep open requests; flag At Risk (≥75% elapsed) and Breached; notify.

**Degradation.** No tier linked, or a blank SLA column → `SLA Outcome = Not covered`. The
request is tracked normally and **never counts as a breach**. This is what lets the portal ship
before management has entered a single number, and lets each tier begin being measured the
moment its row is filled.

---

## 6. Client identity

- NextAuth **Email provider** (magic link) in the portal app
- Email service provisioned via Vercel Marketplace `messaging` category
  (`vercel integration discover --category messaging` — **requires CLI ≥58**; the machine
  currently has 50.1.0)
- Airtable People is the identity source of truth. A sign-in succeeds only if a People record
  matches the email **and** `Portal Access` is checked **and** `Company` is set.
- Session carries: email · People recId · Company recId · Portal Role · the retainer quote IDs
  scoped to that Company.
- **Every portal query filters on the session's Company recId.** No exceptions.

**Invites.** Ops seeds the first contact per retainer from the manager view (creates/updates a
People record, sets `Portal Access` + `Portal Role = Owner`, stamps `Portal Invited At`). An
Owner can invite colleagues into their own Company; invitees default to `Member`. Members can
view and submit; only Owners can invite.

---

## 7. Portal surface

| Route | Contents |
|---|---|
| `/login` | Email entry → magic link |
| `/` | Agreement card (tier, rate, included hours, term, effective date, SLA label) · open requests · SLA status |
| `/requests` | List with status/priority filters |
| `/requests/new` | Title · description · priority |
| `/requests/[id]` | Detail + comment thread |
| `/team` | Company members; invite (Owner only) |

Branding reuses the existing Airvues surface (`AuroraBackdrop`, `LiveClock`, the design tokens
in `app/globals.css`), matching the public `/r/[token]` Loops share page.

---

## 8. Internal surfaces (ops app)

**`/retainers` — cross-retainer health board.** One row per active retainer: open requests,
oldest unanswered, breaches this period, hours burned vs. included, next renewal. This is the
"which retainer is at risk?" page.

**`/retainers/[id]` — deep dive.** Request history, response-time distribution, contacts +
invite controls, agreement terms, hours ledger for the current anniversary period.

**Dev inbox.** A section on `/me` — "Client requests assigned to you" — plus an assignee filter
on the board.

**Triage.** From a request, create one or more Stories on the retainer quote, linked back via
`Retainer Requests.Stories`.

**Nav + permissions.** New entry in `lib/nav.ts`; new `Retainers` permission in
`lib/permissions.ts` + `ROUTE_PERMISSION`; `assertCanAccess("/retainers")` at the top of each
page. Nav hiding is cosmetic — the page guard is the gate.

---

## 9. Risks

**Hours-gauge data quality (blocks v1.1).** Showing "31 of 45 hours used" requires
`Stories.Hours` to be current. It is not — Gracie Barra's stories were created up to six weeks
after completion. Shipped against today's data, a client would see 0 hours all month, then a
cliff. **Precondition: weekly logging discipline.** Until then, no gauge.

**Client-set priority is abusable.** Everything becomes Urgent. Mitigated by
`Max Urgent / Month` on the tier. Enforcement behaviour when exceeded (block, warn, or
downgrade) is unresolved — see Open questions.

**Ops-app mutation gates remain permissive.** `requireSignedIn()` still guards every ops
mutation. Separation means this is no longer a portal risk, but it remains a latent issue in the
ops app and should be tracked independently of this project.

**Airtable as an application database.** Rate limit is 5 req/s. A busy request thread means many
small reads. Mitigation: `listRecordsCached` with tight tags, and per-company query scoping.
Revisit if a retainer exceeds roughly 100 open requests.

**Email deliverability.** Magic-link auth means an undelivered email is a locked-out client.
Requires SPF/DKIM on the sending domain before launch, and an ops-visible "resend invite".

---

## 10. Open questions

1. `Max Urgent / Month` enforcement — hard block, soft warning, or auto-downgrade?
2. Request number prefix — `REQ-1` (built) vs. the `GB-142` convention Gracie Barra uses
   informally. Formula edit, decide any time.
3. Holiday list — code constant vs. Airtable table. Starting as a constant.
4. Portal domain name — `portal.airvues.com` assumed, not confirmed.

---

## 11. Sequencing

| # | Spec | Delivers | Depends on |
|---|---|---|---|
| **0** | Schema foundation | ✅ **Done 2026-08-06** — 3 tables, 6 fields, tenant backfill, `schema.ts` regenerated (41 tables / 897 fields) | — |
| **1** | SLA engine + tier resolution | Business-day math, tier lookup, degradation, unit tests | 0 |
| **2** | Internal surfaces | Health board, deep dive, dev inbox, triage → Story | 0, 1 |
| **3** | Client identity | Portal repo, email provisioning, magic link, invites, Company scoping | 0 |
| **4** | Client portal | Agreement view, submit, thread, notifications | 1, 2, 3 |

**Spec 2 ships before Spec 4 deliberately.** Ops can file requests on a client's behalf from
what arrives by email today, exercising the SLA math against real traffic with zero external
exposure. If the business-day arithmetic is wrong, it is found internally rather than by a
client disputing a breach.
