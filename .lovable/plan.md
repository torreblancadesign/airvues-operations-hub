## Scope

Two presentation changes — clients page and projects (pipeline) page. Both purely UI / data-shape additions on existing fields.

---

## 1. Clients page — swap Engagement → Lead/Partner

**File: `components/clients/ClientsDashboard.tsx`**

- Replace the **Engagement** table column with a **Type** column showing `partnerStatus` ("Lead" / "Client") as a colored pill (Client → emerald, Lead → violet, null → muted "—").
- Replace the `engagement` sort key with `partnerStatus`.
- Remove the engagement pill color map; add a small partner color map.
- Keep the existing "Partner status" filter dropdown (already wired) — it now becomes the primary filter for this column.
- Leave the KPI tiles and engagement-distribution bar chart untouched (they still segment by engagement, which remains useful internally) — only the **row column** changes per the request. If you'd prefer to also drop those tiles, say so and I'll cut them.

No changes to `lib/clients.ts` — `partnerStatus` is already on `ClientRow`.

---

## 2. Projects page — add Company column

**File: `lib/pipeline.ts`**

- Add `company: string | null` to `PipelineQuote`.
- Request the `Company Name` lookup field (`fld3HBa2PRe362JHs`, "Company Name" on Quotes) and map first value into `company`.

**File: `components/pipeline/QuoteTable.tsx`**

- Insert a new **Company** column between "Client" (contact person) and "Prep By".
- Header is plain (non-sortable initially — matches "Prep By" style). Cell renders `q.company ?? "—"`, truncated like the project name.
- Bump the empty-state `colSpan` from 10 → 11.

**File: `components/pipeline/types.ts`** (only if `SortKey` is exhaustive) — no change needed since column is non-sortable.

---

## Technical notes

- `partnerStatus` values come from `lib/leads.ts` `PartnerStatusValue` ("Lead" | "Client") — already typed.
- "Company Name" on the Quotes table is a `multipleLookupValues` field; use the same `first()` helper already in `lib/pipeline.ts`.
- No mutation paths, no schema changes, no auth changes. Cached-read tag stays `pipeline:all-quotes` — `revalidateTag("airtable")` on any future write still invalidates it.
- Verify with `npx tsc --noEmit` and `npm run build` after edits.

## Out of scope (ask if you want them next)

- Filtering projects by company.
- Sorting projects by company.
- Removing the engagement KPI tiles / distribution chart on /clients.
