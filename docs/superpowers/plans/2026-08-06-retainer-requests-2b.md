# Retainer Requests (Plan 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Close the internal loop — ops can file a retainer request, drill into it, respond (stopping the SLA clock), triage it into a Story, and see all of it reflected on the board.

**Definition of done for the whole feature (and the PR gate):** a request created from the UI appears on `/retainers`, its detail page shows the thread, posting an Airvues reply stamps `First Responded At` and flips `SLA Outcome` to Met or Breached, the board's counts change accordingly, and a request can be triaged into a Story on the retainer's quote. Nothing is PR'd before that is demonstrated end-to-end against the live base.

**Depends on:** Plan 1 (SLA engine) + Plan 2 (board) — branch `retainer-internal-surfaces`

## Global Constraints

- Carries every constraint from Plans 1 and 2.
- **All writes are Server Actions in `lib/mutations/`, gated by `requireSignedIn()`**, matching every other mutation in this repo.
- **`revalidateTag("airtable")` after every write**, plus `retainers:requests` / `retainers:comments`.
- **The SLA clock is stopped by the FIRST Airvues comment only.** Client comments never stop it. An internal-only comment (`Visible to Client` unchecked) still counts as a response — it is a human replying, and hiding it from the client is a separate concern.
- **`Company` is written explicitly on every request** from the retainer's `companyId`. Never left to be derived.
- **Never write `SLA Outcome = "Breached"` when there is no deadline.** `Not covered` is terminal until a tier is filled in.

## Tasks

### Task 1 — Comment reads + request detail

**Files:** `lib/retainer-types.ts` (modify), `lib/retainer-requests.ts` (modify)

Produces:
- `type RetainerComment = { id: string; requestId: string | null; authorId: string | null; authorSide: "Client" | "Airvues" | null; body: string; createdAt: string | null; visibleToClient: boolean }`
- `listRetainerComments(requestId: string): Promise<RetainerComment[]>` — ascending by `createdAt`
- `getRetainerRequest(id: string): Promise<RetainerRequest | null>`

### Task 2 — Mutations

**Files:** `lib/mutations/retainer-request.ts` (create)

Produces:
- `createRetainerRequest(input: { retainerId: string; title: string; description: string; priority: RetainerPriority; submittedById?: string | null; submittedAt?: string })` — resolves the retainer's tier, computes `SLA Due At` via `computeSlaDueAt`, sets `SLA Outcome` to `Pending` or `Not covered`, writes `Company` from the agreement, `Status = "Submitted"`.
- `addRetainerComment(input: { requestId: string; body: string; side: "Client" | "Airvues"; visibleToClient?: boolean })` — creates the comment; **if `side === "Airvues"` and `First Responded At` is empty**, stamps it and re-evaluates `SLA Outcome` via `evaluateSlaOutcome`.
- `updateRetainerRequest(requestId, patch: { status?; assignedToId?; priority? })` — a priority change recomputes `SLA Due At` from the **original** `Submitted At`, then re-evaluates the outcome. Setting `Closed`/`Declined` stamps `Closed At`.
- `triageRequestToStory(input: { requestId: string; name: string; hours: number; invoice: number; assigneeIds?: string[] })` — creates a Story on the retainer's quote and links it back to the request.

The outcome re-evaluation lives in one private helper used by all three write paths, so the rule cannot drift between them.

### Task 3 — Deep dive `/retainers/[id]`

**Files:** `app/(app)/retainers/[id]/page.tsx`, `components/retainers/RetainerDetail.tsx`, `components/retainers/RequestThread.tsx`, `components/retainers/NewRequestModal.tsx`

Agreement summary (tier, rate, included hours, term, effective date, period, SLA label) + request list with SLA state chips + selected-request thread + "New request" + triage. Board rows link here instead of `/pipeline/[id]`.

### Task 4 — Dev inbox on `/me`

**Files:** `components/me/AssignedRequests.tsx`, `app/(app)/me/page.tsx` (modify)

"Client requests assigned to you", sorted by SLA urgency. Hidden entirely when the signed-in person has none, so it costs nothing for engineers not on a retainer.

### Task 5 — End-to-end verification against the live base

Create a real request on the Gracie Barra retainer, confirm the board count changes, reply, confirm `First Responded At` and `SLA Outcome`, triage to a Story, then **delete the test records** so production is left clean. Only after this passes does the feature become PR-able.

## Risks

- **Test data in production.** Task 5 writes real records to the live base. Every one is deleted at the end, and the retainer chosen (Gracie Barra) is the one already under active development. No existing record is modified.
- **Priority change semantics.** Recomputing the deadline from the original submit time means lowering priority can retroactively turn a breach into a met SLA. That is the correct reading — the deadline follows the agreed response time for the priority actually assigned — but it is a judgement call worth review.
