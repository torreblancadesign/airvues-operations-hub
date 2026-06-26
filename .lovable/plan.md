## Goals

Three small polishes to the Retainer (and standard) Quote Stories experience, plus confirm the prior async build error is stale.

### 1. NewQuoteStoryModal — remove Client Notes when adding a story

- In `components/pipeline/NewQuoteStoryModal.tsx`, drop the Client Notes textarea and its `clientNotes` state entirely (it's currently always shown). Client notes can still be edited inline from the table/drawer after creation.

### 2. QuoteStoriesTable — make "Open story" much more discoverable

In `components/pipeline/QuoteStoriesTable.tsx`:
- Replace the tiny `↗` glyph in the right-side `w-[40px]` cell with a proper button: a lucide `ArrowUpRight` (or `Maximize2`) icon inside a bordered pill that says "Open", visible on every row (not hover-only), right-aligned, with `title="Open story details"`.
- Additionally, make the **Story Name cell itself clickable** — wrap the name text in a button styled as a subtle link (underline-on-hover, ink-strong color) that also calls `onRowClick(s.id)`. This gives two obvious affordances: click the name OR the "Open" pill.
- Keep `stopBubble` behavior on all inline-edit cells so editing fields never accidentally opens the drawer.

### 3. Month group headers — collapsible + bigger, clearer totals

In `QuoteStoriesTable.tsx` (`FragmentGroup` + parent):
- Lift collapsed-state up to the table: `const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())` keyed by `group.key`, persisted to `localStorage` under `qst:${quoteId}:collapsedMonths` so it survives reloads.
- Redesign the month header row: replace the small uppercase 10px label with a taller (py-2.5) row containing:
  - A chevron button on the left (`ChevronDown` when open, `ChevronRight` when collapsed) that toggles the group.
  - Month label at `text-[14px] font-semibold text-ink-strong` (e.g. "June 2026"), with a colored dot if it's the current month.
  - Right side: two compact stat pills — `{n} stories` and `{totalHours}h` — at `text-[12px]` with tabnum, bg-bg-elevated/80, border-rule, rounded.
  - Only show the row's stories when not collapsed (skip rendering `SortableStoryRow`s for collapsed groups).
- Default state: current + most recent month expanded, older months collapsed.
- Apply only when `groupByMonth` is true; non-retainer rendering stays unchanged.

### 4. Stale build error

The "dist-check failed" message is leftover from the prior async build; a fresh local typecheck now passes clean. No additional fix needed — the next build after these edits will clear it.

## Out of scope

- No schema or mutation changes.
- No changes to non-retainer (standard quote) stories table layout besides the new "Open" button affordance (which is a global UX win).
- No drag-and-drop changes.

## Technical notes

- `lucide-react` already used elsewhere in the project — import `ArrowUpRight`, `ChevronDown`, `ChevronRight` from it.
- Persisted collapsed state uses a JSON-serialized array of keys, hydrated in a `useEffect` to avoid SSR hydration mismatch.
- Stats per group already computed in `monthGroups` memo (`totalHours`, `stories.length`) — just re-style.
