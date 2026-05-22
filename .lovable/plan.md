## Goal

Make the lead detail drawer (`components/leads/LeadSheet.tsx`) match the Airtable interface in the screenshot: show all the same fields in the same two-section structure, and let permitted users edit the "Lead Assessment" fields directly from the dashboard (writes back to Airtable).

## Field map (from screenshot)

**Top section — Lead intake (READ-ONLY)** — these come from Fillout / manual scheduling and shouldn't be touched from the dashboard:
- Email
- Title
- Company Name
- Meeting Date
- Meeting Link
- Budget (pill)
- What are you looking to build? (long text)

**Lead Assessment section — EDITABLE** (by admin/lead/editor via `canMutate()`):
- Paste Meeting Transcript — multiline textarea, saves to `Paste Meeting Transcript`
- Attach Supporting Documentations — file upload, saves to `Attach Supporting Documentations` (multipleAttachments)
- Status — single-select dropdown (`New Lead`, `Needs Review`, `In Proposal Stage`, `Sold`, `Not Sold`), saves to `Status`

Everything already on the existing drawer that isn't in the screenshot (Source, Created, Assessor, Client Introduction (AI), Linked quotes, Airtable Record ID, Join Meet / Email / Airtable buttons) stays — it's useful context that just isn't visible in the Airtable crop. They remain read-only.

## Implementation

1. **`lib/mutations/lead.ts` (new)** — server actions, mirrors the pattern in `lib/mutations/story.ts` and `lib/mutations/person.ts`:
   - `updateLeadStatus({ leadId, status })`
   - `updateLeadTranscript({ leadId, transcript })`
   - `addLeadAttachments({ leadId, attachments: { url, filename }[] })` and `removeLeadAttachment({ leadId, attachmentId })`
   - Each calls `requireRole("admin", "lead", "editor")`, validates input with zod (status enum, transcript length cap ~50k chars), uses `patchRecords(Tables.Leads.id, …)` with field IDs from `lib/schema.ts`, then `revalidateTag("airtable")` + `revalidateTag("leads:all")`.
   - For attachments: Airtable's PATCH expects an array of `{ url, filename }` for new files, or the existing array minus the removed one. Since we already store existing attachments, we send the merged array.

2. **`lib/leads.ts`** — extend `Lead` type and the field list to include `attachments: { id, filename, url, type, size }[]`. Add the field ID `Attach Supporting Documentations` to the `fields[]` list and map it through.

3. **`components/leads/LeadSheet.tsx`** — restructure into two visual sections matching the screenshot:
   - "Lead Details" (read-only fields as today, but reordered to mirror Airtable: Email, Title, Company Name, Meeting Date, Meeting Link, Budget pill, What to build).
   - "Lead Assessment" with editable controls when `canEdit` is true (else render values read-only).
     - Transcript: textarea with Save / Cancel, optimistic `useTransition`, "edited" indicator.
     - Attachments: list existing files with download link + delete (×) button; drop-zone / file-input that uploads via a tiny client-side upload flow. Simplest version for v1: a "Paste file URL" + filename input (since we don't have a blob store wired). If a blob store isn't desired right now, we'll stub the attachments editor as read-only and just display existing attachments — confirm preference (see open question).
     - Status: native `<select>` styled to match the existing status pills; on change calls `updateLeadStatus` with optimistic update.
   - Existing extra read-only fields (Source, Created, Assessor, Client Introduction, Linked quotes, Record ID, action buttons) remain at the bottom in a collapsible "More" group so the drawer mirrors Airtable but still keeps the operational context.

4. **`components/leads/LeadsDashboard.tsx`** — pass a `canEdit` prop into `LeadSheet`, derived from `canMutate()` resolved server-side and threaded through (matches the pattern used on `/me` for `canEditGoal`).

5. **`app/(app)/leads/page.tsx`** — compute `canEdit = await canMutate()` and pass to `LeadsDashboard`.

## Out of scope

- Editing intake fields (Email, Title, Company Name, Budget, etc.) — those originate from the Fillout form and shouldn't be touched in the dashboard.
- A real file-storage pipeline for attachments (we'd need S3 / Vercel Blob). See open question below.
- Bulk status changes from the table — single-record only for now.

## Open question

For **Attach Supporting Documentations**, do you want:
- (a) **View-only for now**: list/download existing files, but no upload from the dashboard (fastest, no blob store needed), or
- (b) **Upload via URL paste**: simple input where user pastes a public URL + filename (works today, ugly UX), or
- (c) **Full upload**: I wire up Vercel Blob / S3 first, then a real drag-and-drop.

If you don't reply I'll go with **(a)** — view-only attachments — and ship transcript + status editing now.
