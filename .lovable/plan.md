## Goal

Add a new **Change Order Input Details** field to the Quote editor — a free-text input where the user feeds context to the AI agent that will draft change order summaries and stories. Render it inside the existing "Change orders" section as a collapsible block using the same chevron-left + microcopy affordance pattern we just shipped.

---

## 1. Schema + types

- `lib/schema.ts` — add `"Change Order Input Details": { id: "Change Order Input Details", type: "multilineText" }` to the Quotes table fields (next to `"Change Order Details"`).
- `lib/quote-types.ts` — add `changeOrderInputDetails: string` to `QuoteDetail`, and `changeOrderInputDetails?: string` to `QuoteFieldPatch`.

## 2. Read path

- `lib/quotes.ts` — extend `QuoteFields` with `"Change Order Input Details"?: string`, then populate `changeOrderInputDetails: asStr(f["Change Order Input Details"])` in the returned `QuoteDetail`.

## 3. Write path

- `lib/mutations/quote.ts` — in the field mapper, add:
  ```ts
  if (patch.changeOrderInputDetails !== undefined)
    fields["Change Order Input Details"] = patch.changeOrderInputDetails;
  ```

## 4. UI — collapsible field inside "Change orders" section

File: `components/pipeline/QuoteSheetEditor.tsx`, just above the existing "Change Order Details" `FieldRow` (line 1053).

Add a new `FieldRow`:
- **Label:** "Change Order Input Details"
- **Hint:** "Raw context for the AI agent — paste meeting notes, scope deltas, client requests. The agent uses this to draft the summary + stories below."
- **Body:** `TextField` multiline, `rows={8}`, placeholder `"Paste change order context for the AI agent here…"`, wired to `patchAndRefresh("changeOrderInputDetails", { changeOrderInputDetails: v })`.

Wrap the body in the same `CollapsibleNotes`-style shell used in `LeadSheet.tsx` so long pastes don't push the rest of the section offscreen:
- Default **collapsed** when value length > 400 chars; expanded otherwise.
- Header row: left chevron (`ChevronDown`/`ChevronRight` 14px, `text-ink-muted`), title "Change Order Input Details", char count on the right (`2,431 chars`), microcopy `Click to expand` / `Click to collapse`, `border-l-2 border-l-emerald/60`, `hover:bg-bg-elevated`, `aria-expanded`.
- Persist open/closed in `localStorage` per-quote: `quote:${quote.id}:co-input-open`.
- When the textarea is being edited, force expanded.
- Empty state: keep header visible with a faint "Empty — click to add context" hint so users know the field exists.

Since `QuoteSheetEditor` already uses the upgraded `Section` collapsible pattern, this nested collapse uses the same visual language (chevron-left, microcopy-right, emerald accent bar) for consistency.

## 5. Out of scope

- Wiring the AI agent itself (assumed to be triggered Airtable-side or via an existing automation against the new field).
- Changing the existing "Change Order Details" field — it stays as the AI's output target.
- Adding a separate "Run change order agent" button (no checkbox/trigger field was mentioned).

## Technical notes

- The new field is `multilineText` in Airtable; no choices to register.
- `Section "Change orders"` itself is already a top-level section in the editor — the new collapsible lives *inside* it, so users get two levels of disclosure (section open → field open), matching how the Leads transcript collapse sits inside the "More Context" section.
