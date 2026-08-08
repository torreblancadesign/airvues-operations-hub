# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (this surface): client-side contacts at Airvues retainer clients.** Named people
on a client's account, held in Airtable People with `Portal Access`, `Portal Role`
(`Owner` / `Member`), and a `Company` link that scopes everything they can see. Owners can
invite colleagues; Members view and submit. They are not technical, have no Airvues account
in the ops sense, and sign in by one-time link with no password.

Their scene is **genuinely two-modal, neither one a fallback**: short phone checks ("has
anyone picked this up yet?") and occasional deliberate desktop sessions ("what did we get
for the money this month?"). Confirmed by the user, 2026-08-08.

**Secondary: Airvues ops.** COO, CTO, trio leads, engineers and contractors, working in the
internal dashboard. They create retainers, set plans, triage requests into Stories, and
grant portal access. Roles: `admin / lead / engineer / client`.

## Product Purpose

Airvues LLC sells monthly retainers: a fixed fee buys a number of hours per month and a
promised first-response time per priority. The portal is the client's own window onto that
arrangement — what they are on, what they have asked for, what has been answered, and how
much of the month's hours are gone.

The user's four success conditions, all in scope (confirmed 2026-08-08):

1. **Prove the retainer is worth it** — hours delivered, requests closed, promises kept.
2. **Kill the status-chasing email** — the answer to "any update?" is always one click away.
3. **Make filing a request effortless** — short enough that clients use it instead of email.
4. **Look like a company worth paying** — for many clients this is the most-seen Airvues
   artifact, and it should feel more considered than the tools their other vendors ship.

## Positioning

The promise is **measured, not asserted**. Response times are tracked in real business hours
— 9am–6pm Pacific, Monday to Friday, holidays excluded — and every request carries a
computed deadline and an outcome of Met, Breached, Pending, or Not covered. A plan with no
response time set degrades to "Not covered" and can never be reported as a breach, so the
number is never flattered.

Most agency retainers are a fee, a vague promise, and a monthly invoice. This one shows the
client the clock.

## Operating Context

- A retainer is a `⚪️ Quotes` record with `Proposal Type = "Retainer Agreement"`, linked to a
  `⚙️ Companies` record. **Company is the tenant key**; every portal read filters on it.
- Plans live in `⚙️ Retainer Tiers`: rate, included hours, four per-priority response windows,
  and optional custom plans scoped to a single client.
- Requests live in `🟣 Retainer Requests` with threaded comments. The SLA clock stops on the
  first Airvues reply.
- Billing periods run on the **retainer's anniversary date, not the calendar month**.
- Ops files requests on the client's behalf today; the portal is what moves that to the client.

## Capabilities and Constraints

**Built:** SLA engine (business-day arithmetic, tier resolution, degradation), plan catalog,
retainer create/edit/archive, request filing/threading/triage-to-Story, ops health board,
dev inbox, client contacts, magic-link sign-in with Company-scoped sessions.

**Not built:** client-side request submission, notifications of any kind, attachments,
invoices in the portal, self-serve signup.

**Constraints:**
- Next.js 14 App Router, TypeScript strict, Tailwind, Airtable as the only datastore.
- No email provider yet. Resend is the intended choice (user, 2026-08-08); until it exists,
  sign-in links are generated in the ops app and handed over manually.
- Portal sessions re-check `Portal Access` against Airtable on every request, so access can
  be revoked mid-session.
- Hours logged frequently lag the work by weeks — a low number means "not logged yet", not
  "not worked". Any hours display must not imply otherwise.

## Brand Commitments

- The product is **Airvues LLC**. The portal is clearly an Airvues product and carries the
  name and mark: `public/airvues-logo.png`, `public/airvues-mark.png`.
- **The internal dashboard's dark theme is explicitly NOT binding on this surface.** The user
  called it "too dark" for a client view (2026-08-08). Its palette, including the emerald
  `#22D3A8`, is evidence of what the company is, not a rule for what the client sees.
- Fonts currently loaded in the app shell: Fraunces (display), Manrope (sans), JetBrains Mono
  (numerics). Not binding on the portal.
- Ambition, stated by the user: a portal "worth a prize" that retains clients.
- **Standing preference, client portal (user, 2026-08-08):** the conventional client-portal
  arrangement, executed at full craft — chosen deliberately over four distinctive
  alternatives. Convention is the commitment here, not a fallback.
- **Quality bar, client portal (user, 2026-08-08): Mercury and Ramp.** Financial-grade
  trust — the number is the hero and set calmly, generous air, quiet chrome, muted ground,
  colour used only to carry meaning, plain language with no jargon. The surface should read
  as "these people are careful with my money".

## Evidence on Hand

Real, in the production base — usable as design material, not to be replaced with invented
equivalents:

- **Gracie Barra** — Brazilian jiu-jitsu school. Platinum plan, $6,750/month, 45 hours
  included, 4 business hours to first response on every priority. Signed and active. 8 people
  linked. Contact: Flavio Almeida.
- **North London Therapy Practice** — unsigned proposal, custom plan ($600 / 4h,
  72–96h response windows), one open request.
- **Dr. Bronner** — rejected quote, retained for history.

The client base spans a martial-arts school, a consumer-goods brand and a therapy practice.
**No single client's sector can drive the design.**

Absences future work must not fabricate: no testimonials, no case studies, no press, no
pricing page, no customer count, no uptime or performance claims.

## Product Principles

1. **The tenant boundary is absolute.** Every portal read filters on the session's Company.
   A client seeing another client's data is the failure that ends the product.
2. **Never flatter the number.** Unmeasured is shown as unmeasured; lagging data is labelled
   as lagging. A promise the system cannot verify is not displayed as kept.
3. **The clock is the product.** Time — hours used, hours left, hours waited, days remaining
   in the period — is the substance of what a client is buying and the substance of what the
   portal shows.
4. **Say what happened, not what the schema did.** Client-facing language, no record IDs, no
   Airtable vocabulary, no internal status names leaking through.
5. **Access is recorded, and revocable at any moment.** Who was let in, by whom, when, and
   why they were removed.

## Accessibility & Inclusion

No formal standard has been set. Confirmed constraints: the surface must hold up on a phone
in variable light including direct sunlight, and on desktop, with neither treated as the
fallback.
