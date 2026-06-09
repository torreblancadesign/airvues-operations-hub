## Scope

Address team feedback across **My Scorecard**, **Sales Pipeline**, **Clients**, and **nav order**. Note: the "Status Funnel" / "By Source" feedback references components that live on the **Leads** page (not My Scorecard) — treating as Leads.

---

## 1. Nav reorder

In `lib/nav.ts`, reorder revenue group: Leads → **Clients** → Sales Pipeline → Earnings. Sidebar, MobileNav, and Home jump-cards all derive from this file.

---

## 2. My Scorecard

**a. "Open project" links go to Airvues One, not Airtable.**
In `components/me/PersonScorecard.tsx`, the "Prepared quotes" table renders `<a href={q.airtableUrl}>`. Replace with a `Link` to the new `/pipeline/[id]` route (built in §4b). Fallback to `/clients/{companyId}` if no quote detail data.

**b. Delete stories from list.**
Add a trash-icon button on each `StoryCard` (in `components/engineering/StoryCard.tsx`), gated by `canEdit`. Confirm dialog → new `deleteStory(id)` mutation in `lib/mutations/story.ts` calling a new `deleteRecords` wrapper in `lib/airtable.ts` (`DELETE /v0/{base}/{table}?records[]=...`, batched at 10) after `requireRole("admin","lead","editor")`. Then `revalidateTag("airtable")` + `router.refresh()`.

---

## 3. Leads page — Status Funnel + By Source react to MTD/YTD

In `components/leads/LeadsDashboard.tsx`, compute `windowedLeads` once and pass to `<StatusFunnel>` and `<SourceBudgetBreakdown>` (today they receive the unfiltered list). Add a small `MTD/YTD` label in each card header.

---

## 4. Sales Pipeline

**a. KPIs react to filters.**
In `PipelineDashboard.tsx`, switch `kpis` and `stageBreakdown` `useMemo` deps from `quotes` → `filtered`. Stage-bucket StatCards continue to drill further by stage.

**b. Full-page quote/project detail.**
New route `app/(app)/pipeline/[id]/page.tsx` + new `components/pipeline/QuoteDetailView.tsx` with collapsible sections (Header, Financials, Stories, People, Sprint, Notes). New `getQuoteDetail(id)` in `lib/pipeline.ts`. `PipelineDashboard` row click → `router.push('/pipeline/${id}')` instead of opening the drawer. `QuoteSheet` stays in place (still used elsewhere) and can be removed later.

---

## 5. Clients

**a. Nav order:** covered in §1.

**b. Client detail shows associated projects.**
In `lib/client-detail.ts`, fetch quotes filtered by `Company == clientId`. Render a new "Projects" table in `ClientDetailView` (Project, Status, Total Cost, Owed, Prepared, Deadline) — each row links to `/pipeline/[id]`.

---

## Files

- New: `app/(app)/pipeline/[id]/page.tsx`, `components/pipeline/QuoteDetailView.tsx`
- Edit: `lib/nav.ts`, `lib/airtable.ts` (+`deleteRecords`), `lib/mutations/story.ts` (+`deleteStory`), `lib/pipeline.ts` (+`getQuoteDetail`), `lib/client-detail.ts` (+projects), `components/me/PersonScorecard.tsx`, `components/engineering/StoryCard.tsx`, `components/leads/LeadsDashboard.tsx`, `components/pipeline/PipelineDashboard.tsx`, `components/clients/ClientDetailView.tsx`

Verification: `npx tsc --noEmit` + `npm run build` + click-test each page.

## Out of scope

- Full Project-as-first-class record (Change Orders, Handoff section) — blueprint Phase 3
- Removing `QuoteSheet` from other pages
- Bulk delete on My Scorecard
