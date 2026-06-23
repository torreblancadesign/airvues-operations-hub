# Compact Overview + Relationship notes

Today both sections sit in a 50/50 grid. Overview stacks 17 single-column `InlineField`s vertically, so its column is ~3× taller than the Relationship notes textarea. That leaves a huge empty rail on the right and pushes Contacts/Projects/Invoices far down the page. The fix is structural, not stylistic.

## Layout shift

`components/clients/ClientDetailView.tsx`, the block around lines 224–339:

- Change the wrapper from `lg:grid-cols-2` to `lg:grid-cols-12 gap-4`.
- **Overview** card: `lg:col-span-8` — gets a denser internal layout.
- **Relationship notes** card: `lg:col-span-4` with `lg:sticky lg:top-4 self-start` so the note stays in view as the overview scrolls beside it.

## Overview card — grouped + 2-column fields

Replace the flat list of 17 `InlineField`s with five labeled subsections. Each subsection is its own block; fields inside render in a `sm:grid-cols-2 gap-x-4` grid so heights roughly halve. Long-form fields (Legal address, Business description) span the full subsection width.

```
Identity         | Industry · Lead source · Client start year · Preferred business
Commercial       | Contract type · Hourly rate · Discount % · Discount reason · NDA on file
Status           | Engagement frequency · Partner status · Lead status
Links            | Website · Drive · Miro · Google Chat
Address          | Legal address (full width, rows 2)
Description      | Business description (full width, rows 4)
```

Subsection headers use the existing eyebrow style (`text-[10px] font-semibold uppercase tracking-wider text-ink-muted`) and a subtle divider above each group after the first. Drop the per-field bottom border from `FieldShell` only inside this card by wrapping these fields with a parent class that resets `border-b` (tailwind arbitrary selector `[&_.border-b]:border-0`) — keeps `InlineField` untouched elsewhere.

Card padding `p-5` → `p-4` to reclaim vertical space.

## Relationship notes — slim companion

Stays a single card. Adjustments:

- `rows={14}` → `rows={10}` (still tall, but no longer dwarfed by Overview).
- Helper line shortens to one phrase: "How they like to be worked with — communication, dynamics, recurring concerns."
- Card padding `p-5` → `p-4`.
- Card becomes `lg:sticky lg:top-4 self-start` so as Overview's column grows, the note rail stays anchored beside it instead of leaving dead space at the bottom of the right column.

## Result

Overview and Relationship end at roughly the same point on the page, the right rail is no longer dead, and Contacts / Projects / Invoices come up sooner without losing any data fields.

## Out of scope

- `InlineField` internals, save logic, field set, or any data layer.
- The header / KPI strip above and the Contacts/Projects/Invoices sections below.
- Visual restyling beyond grouping, density, and stickiness.
