# Engineering Page Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/engineering` into one unified roster (capacity header rows + expandable story tables), with dead metrics removed, a single home for Unassigned, a sticky filter bar with a Priority filter, and stories rendered as a table instead of a card gallery.

**Architecture:** Pure client-component refactor inside `components/engineering/`. The data layer (`lib/engineering.ts`), `StorySheet` drawer, mutations, and the page shell (`app/(app)/engineering/page.tsx`) are untouched. `EngineeringBoard.tsx` remains the orchestrator; two new focused components (`RosterRow.tsx`, `StoryTable.tsx`) and one shared badge module (`story-badges.tsx`) are added; `CapacityPanel.tsx` is deleted.

**Tech Stack:** Next.js 14 App Router, React 18 client components, Tailwind CSS (project tokens: `ink`, `rule`, `surface`, `emerald`, `amber`, `red`, `sky`, `violet`), TypeScript strict.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-engineering-page-rework-design.md`.
- **No test suite exists in this repo** (per CLAUDE.md). The test cycle for every task is: `npx tsc --noEmit` (must exit 0) + visual check on the dev server at `http://localhost:3002/engineering`. Final task adds `npm run build`.
- Do NOT touch `lib/engineering.ts`, `lib/engineering-types.ts`, `StorySheet.tsx`, `lib/mutations/*`, or `app/(app)/engineering/page.tsx`.
- Do NOT remove `hoursWorked` from types or the drawer — only from board/roster UI.
- `StoryCard.tsx` must keep compiling (used by `components/me/PersonScorecard.tsx`).
- The orphan group id from the data layer is the literal string `"__orphan__"`.
- TopBar is `sticky top-0 z-30 h-12` on `md+`, hidden below `md` → the sticky filter bar uses `top-0 md:top-12` and `z-20`.
- Priority choices are exactly: `Urgent, High, Medium, Low` (Airtable enum — see CLAUDE.md schema gotchas).
- Story status values used in counts: `"In progress"` (lowercase p), `"QA Review"`, `"Todo"` — byte-exact.
- Commit after every task. Never commit `.env.local` or scratch files.

---

### Task 1: Filter plumbing — Priority filter in, orphan controls out

**Files:**
- Modify: `components/engineering/types.ts`
- Modify: `components/engineering/FilterBar.tsx`
- Modify: `components/engineering/EngineeringBoard.tsx:20-41` (storyMatches + hook keys)

**Interfaces:**
- Consumes: existing `Filter`, `EMPTY_FILTER`, `useSearchParamsFilter`.
- Produces: `Filter` gains `priority: string | null`; `PRIORITIES` const exported from `types.ts`. FilterBar no longer renders the orphan checkbox nor the `__orphan__` engineer option (Task 4 relies on the KPI card being the only orphan toggle).

- [ ] **Step 1: Extend the Filter type**

In `components/engineering/types.ts`, add `priority` to the type and default, and export the enum list:

```ts
export type Filter = {
  search: string;
  status: StatusBucket;
  engineerId: string | null;
  client: string | null;
  sprintNumber: number | null;
  priority: string | null;
  orphanOnly: boolean;
};

export const EMPTY_FILTER: Filter = {
  search: "",
  status: "active",
  engineerId: null,
  client: null,
  sprintNumber: null,
  priority: null,
  orphanOnly: false,
};

// Airtable enum — byte-exact (see CLAUDE.md schema gotchas)
export const PRIORITIES = ["Urgent", "High", "Medium", "Low"] as const;
```

- [ ] **Step 2: Match on priority + sync it to the URL**

In `components/engineering/EngineeringBoard.tsx`:

Inside `storyMatches`, after the sprint check (line ~33), add:

```ts
  if (f.priority && s.priority !== f.priority) return false;
```

In the `useSearchParamsFilter` call, add `"priority"` to `keys`:

```ts
  const [filter, setFilter] = useSearchParamsFilter<Filter>({
    defaults: EMPTY_FILTER,
    keys: ["search", "status", "engineerId", "client", "sprintNumber", "priority", "orphanOnly"],
  });
```

- [ ] **Step 3: FilterBar — add Priority select, remove orphan controls**

In `components/engineering/FilterBar.tsx`:

a. Import `PRIORITIES`: change the first import to
```ts
import { EMPTY_FILTER, Filter, PRIORITIES, StatusBucket } from "./types";
```

b. After the Sprint `<select>` (ends line ~126), add:

```tsx
        <select
          value={filter.priority ?? ""}
          onChange={(e) => update("priority", e.target.value || null)}
          className={selectCls}
          aria-label="Priority filter"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
```

c. Delete the entire "Orphan only" `<label>` block (lines ~128-136).

d. Delete the `<option value="__orphan__">Unassigned (orphan)</option>` line from the engineer select.

e. In `hasActive`, replace `filter.orphanOnly` with `filter.priority !== null || filter.orphanOnly` (orphanOnly can still be set via the KPI card, so Clear must still reset it):

```ts
  const hasActive =
    filter.search !== "" ||
    filter.status !== "active" ||
    filter.engineerId !== null ||
    filter.client !== null ||
    filter.sprintNumber !== null ||
    filter.priority !== null ||
    filter.orphanOnly;
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → expect exit 0.
On `http://localhost:3002/engineering`: pick "Urgent" in the new Priority select → story count drops and URL contains `?priority=Urgent`; the orphan checkbox and the "Unassigned (orphan)" dropdown option are gone; Clear resets everything.

- [ ] **Step 5: Commit**

```bash
git add components/engineering/types.ts components/engineering/FilterBar.tsx components/engineering/EngineeringBoard.tsx
git commit -m "Add priority filter, remove duplicate orphan controls from engineering filter bar"
```

---

### Task 2: Shared badges module + StoryTable component

**Files:**
- Create: `components/engineering/story-badges.ts`
- Create: `components/engineering/StoryTable.tsx`
- Modify: `components/engineering/StoryCard.tsx:12-33` (import badges instead of local copies)

**Interfaces:**
- Consumes: `Story` from `@/lib/engineering-types`.
- Produces:
  - `statusTone(status: string | null): string` and `priorityDot(p: string | null): string` from `./story-badges`.
  - `StoryTable({ stories, selectedId, onSelect }: { stories: Story[]; selectedId: string | null; onSelect: (s: Story) => void })` — Task 4 mounts this inside each roster row.

- [ ] **Step 1: Extract badge helpers**

Create `components/engineering/story-badges.ts` with the two functions currently duplicated in `StoryCard.tsx` (verbatim tones):

```ts
// Shared status/priority tone helpers for story list views.
export function statusTone(status: string | null): string {
  switch (status) {
    case "In progress": return "bg-emerald/15 text-emerald border-emerald/30";
    case "Todo": return "bg-bg-elevated text-ink-muted border-rule";
    case "QA Review": return "bg-sky/15 text-sky border-sky/30";
    case "Completed": return "bg-violet/15 text-violet border-violet/30";
    case "On Hold": return "bg-amber/15 text-amber border-amber/30";
    case "Incomplete": return "bg-red/15 text-red border-red/30";
    case "Analysis Required": return "bg-amber/15 text-amber border-amber/30";
    default: return "bg-bg-elevated text-ink-muted border-rule";
  }
}

export function priorityDot(p: string | null): string {
  switch (p) {
    case "Urgent": return "bg-red";
    case "High": return "bg-amber";
    case "Medium": return "bg-sky";
    case "Low": return "bg-ink-faint";
    default: return "";
  }
}
```

- [ ] **Step 2: Point StoryCard at the shared module**

In `components/engineering/StoryCard.tsx`: delete the local `statusTone` (lines 12-23) and `priorityDot` (lines 25-33) function definitions and add:

```ts
import { statusTone, priorityDot } from "./story-badges";
```

- [ ] **Step 3: Create StoryTable**

Create `components/engineering/StoryTable.tsx`:

```tsx
"use client";

import { Story } from "@/lib/engineering-types";
import { statusTone, priorityDot } from "./story-badges";

type Props = {
  stories: Story[];
  selectedId: string | null;
  onSelect: (s: Story) => void;
};

// Compact one-row-per-story table. Pay/quote/description details live in the
// StorySheet drawer — this view is for scanning and comparing.
const GRID =
  "lg:grid lg:grid-cols-[120px_52px_86px_minmax(220px,1fr)_minmax(130px,0.5fr)_56px_56px] lg:gap-3 lg:items-center";

export function StoryTable({ stories, selectedId, onSelect }: Props) {
  if (stories.length === 0) {
    return (
      <div className="px-4 py-4 text-[12px] text-ink-muted">
        No stories match the current filter.
      </div>
    );
  }

  return (
    <div>
      <div
        className={`hidden ${GRID} border-b border-rule px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-faint`}
      >
        <div>Status</div>
        <div>#</div>
        <div>Priority</div>
        <div>Story</div>
        <div>Client</div>
        <div>Sprint</div>
        <div className="text-right">Est</div>
      </div>

      <div className="divide-y divide-rule">
        {stories.map((s) => {
          const isSelected = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={`block w-full px-4 py-2 text-left transition-colors hover:bg-bg-elevated ${GRID} ${
                isSelected ? "bg-emerald/5 ring-1 ring-inset ring-emerald/30" : ""
              }`}
            >
              {/* Status */}
              <div className="mb-1 lg:mb-0">
                <span
                  className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${statusTone(s.status)}`}
                >
                  {s.status ?? "—"}
                </span>
              </div>

              {/* Number — desktop only; folded into the name line on mobile */}
              <div className="hidden font-mono text-[11px] text-ink-faint tabnum lg:block">
                {s.storyNumber != null ? `#${s.storyNumber}` : "—"}
              </div>

              {/* Priority */}
              <div className="hidden items-center gap-1.5 lg:flex">
                {s.priority ? (
                  <>
                    <span className={`h-1.5 w-1.5 rounded-full ${priorityDot(s.priority)}`} />
                    <span className="text-[11px] text-ink-muted">{s.priority}</span>
                  </>
                ) : (
                  <span className="text-[11px] text-ink-faint">—</span>
                )}
              </div>

              {/* Name (mobile: prefixed with # and followed by client/est line) */}
              <div className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink-strong">
                  <span className="mr-1 font-mono text-[10px] text-ink-faint lg:hidden">
                    {s.storyNumber != null ? `#${s.storyNumber}` : ""}
                  </span>
                  {s.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-muted lg:hidden">
                  {s.clientNames[0] ?? "No client"}
                  {s.priority ? ` · ${s.priority}` : ""}
                  {s.hours != null ? ` · ${s.hours}h est` : ""}
                </span>
              </div>

              {/* Client */}
              <div className="hidden min-w-0 lg:block">
                <span className="block truncate text-[12px] text-ink-muted">
                  {s.clientNames[0] ?? "—"}
                </span>
              </div>

              {/* Sprint */}
              <div className="hidden font-mono text-[11px] text-ink-muted tabnum lg:block">
                {s.sprintNumbers[0] != null ? `S${s.sprintNumbers[0]}` : "—"}
              </div>

              {/* Est hours */}
              <div className="hidden text-right font-mono text-[11px] text-ink-strong tabnum lg:block">
                {s.hours != null ? `${s.hours}h` : "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → exit 0 (StoryTable compiles even though nothing mounts it yet; StoryCard still compiles for `/me`).
Visit `http://localhost:3002/me` → scorecard still renders story cards (badge extraction didn't break it).

- [ ] **Step 5: Commit**

```bash
git add components/engineering/story-badges.ts components/engineering/StoryTable.tsx components/engineering/StoryCard.tsx
git commit -m "Add StoryTable and shared story badge helpers"
```

---

### Task 3: KPI strip rework + banner removal

**Files:**
- Modify: `components/engineering/EngineeringBoard.tsx:88-172` (KPI strip, orphan banner, bottleneck banner)

**Interfaces:**
- Consumes: `data.totals` (`activeStories`, `totalStories`, `completedStories`, `orphanStories`, `qaReviewCount`), `data.groups[].totals.inProgressCount`, existing `StatCard` (`label`, `value`, `sub`, `tone`, `active`, `onClick`).
- Produces: the 4-card strip `Active stories · In progress now · Unassigned · QA queue`. No banners. (Task 4 renders the roster directly below the filter bar.)

- [ ] **Step 1: Compute the in-progress total**

In `EngineeringBoard`, next to the existing `filteredCount` memo, add:

```ts
  const inProgressNow = useMemo(
    () => data.groups.reduce((sum, g) => sum + g.totals.inProgressCount, 0),
    [data.groups],
  );
```

- [ ] **Step 2: Replace the KPI strip**

Replace the four `StatCard`s (lines ~89-115) with:

```tsx
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Active stories"
          value={data.totals.activeStories.toLocaleString()}
          sub={`${data.totals.totalStories.toLocaleString()} total · ${data.totals.completedStories} done`}
        />
        <StatCard
          label="In progress now"
          tone="emerald"
          value={inProgressNow.toLocaleString()}
          sub="Being worked on right now"
        />
        <StatCard
          label="Unassigned"
          tone={data.totals.orphanStories > 0 ? "red" : "neutral"}
          value={data.totals.orphanStories.toLocaleString()}
          sub="Stories with no engineer"
          active={filter.orphanOnly}
          onClick={() => setFilter({ ...filter, orphanOnly: !filter.orphanOnly })}
        />
        <StatCard
          label="QA queue"
          tone={data.totals.qaReviewCount > 0 ? "amber" : "neutral"}
          value={data.totals.qaReviewCount.toLocaleString()}
          sub="Waiting on review"
          active={filter.status === "qa"}
          onClick={() =>
            setFilter(
              filter.status === "qa"
                ? { ...filter, status: "active" }
                : { ...EMPTY_FILTER, status: "qa" },
            )
          }
        />
      </div>
```

- [ ] **Step 3: Delete both banners**

Delete the orphan banner JSX block (`{data.totals.orphanStories > 0 && !filter.orphanOnly && (...)}`, lines ~120-150) and the bottleneck banner block (`{(data.totals.qaReviewCount > 0 || ...)}`, lines ~152-172). Remove the now-unused `Link` import **only if** nothing else in the file uses it (the scorecard link in the sections still does until Task 4 — leave it).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → exit 0.
On `/engineering`: 4 cards read Active 27 · In progress now (>0) · Unassigned 11 · QA queue 1; clicking QA queue filters the list and highlights the card; clicking again restores; red/amber banners no longer render.

- [ ] **Step 5: Commit**

```bash
git add components/engineering/EngineeringBoard.tsx
git commit -m "Rework engineering KPI strip, fold banners into clickable cards"
```

---

### Task 4: Unified roster — RosterRow + merge, CapacityPanel deleted

**Files:**
- Create: `components/engineering/RosterRow.tsx`
- Modify: `components/engineering/EngineeringBoard.tsx` (roster assembly replaces the sections list; CapacityPanel + StoryCard imports removed)
- Delete: `components/engineering/CapacityPanel.tsx`

**Interfaces:**
- Consumes: `StoryTable` from Task 2; `EngineerGroup` + `Story` from `@/lib/engineering-types`; groups carry `visibleStories: Story[]` (computed in the board, as today).
- Produces:
  - `RosterRow({ group, stories, maxAssigned, expanded, onToggle, selectedId, onSelectStory })` where `group: EngineerGroup`, `stories: Story[]` (already filtered), `maxAssigned: number`.
  - Roster ordering: orphan row pinned first, working engineers by `inProgressCount` desc then `activeHoursAssigned` desc, one collapsed "free engineers" row last.

- [ ] **Step 1: Create RosterRow**

Create `components/engineering/RosterRow.tsx`:

```tsx
"use client";

import Link from "next/link";
import { EngineerGroup, Story } from "@/lib/engineering-types";
import { StoryTable } from "./StoryTable";

type Props = {
  group: EngineerGroup;
  stories: Story[]; // pre-filtered by the board
  maxAssigned: number; // max activeHoursAssigned across engineers, for bar scaling
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelectStory: (s: Story) => void;
};

export function RosterRow({
  group,
  stories,
  maxAssigned,
  expanded,
  onToggle,
  selectedId,
  onSelectStory,
}: Props) {
  const t = group.totals;
  const barPct =
    maxAssigned > 0 ? Math.min(100, (t.activeHoursAssigned / maxAssigned) * 100) : 0;

  return (
    <section
      className={`bg-surface border border-rule rounded-card overflow-hidden ${
        group.isOrphan ? "border-red/30" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${group.isOrphan ? "bg-red" : "bg-emerald"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold text-ink-strong leading-tight truncate">
                {group.name}
              </span>
              <span className="hidden sm:flex items-center gap-3 shrink-0 text-[11px] font-mono text-ink-muted tabnum">
                {t.inProgressCount > 0 && (
                  <span className="text-emerald">{t.inProgressCount} doing</span>
                )}
                {t.todoCount > 0 && <span>{t.todoCount} todo</span>}
                {t.qaCount > 0 && <span className="text-sky">{t.qaCount} QA</span>}
                <span className="text-ink-strong">{t.activeHoursAssigned}h</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${group.isOrphan ? "bg-red" : "bg-emerald"}`}
                style={{ width: `${Math.max(barPct, 2)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-ink-muted truncate">
              {group.isOrphan
                ? "Stories waiting for an engineer"
                : (group.role ?? "Engineer") +
                  (group.internalType ? ` · ${group.internalType}` : "")}
            </div>
          </div>
        </div>
        <span className="text-ink-faint text-[14px] font-mono w-3 shrink-0">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-rule">
          <div className="px-4 py-2 bg-bg-elevated border-b border-rule flex items-center justify-end gap-4 text-[11px]">
            {group.isOrphan ? (
              <Link
                href="/hygiene/orphans"
                className="text-red hover:text-red/80 transition-colors font-mono"
              >
                Triage →
              </Link>
            ) : (
              <Link
                href={`/me?as=${group.id}`}
                className="text-emerald hover:text-emerald/80 transition-colors font-mono"
              >
                View scorecard →
              </Link>
            )}
          </div>
          <StoryTable stories={stories} selectedId={selectedId} onSelect={onSelectStory} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Rebuild the board's list around the roster**

In `components/engineering/EngineeringBoard.tsx`:

a. Imports: remove `import { StoryCard } from "./StoryCard";` and `import { CapacityPanel } from "./CapacityPanel";`; add `import { RosterRow } from "./RosterRow";`. Remove `Link` from imports if the scorecard link (now in RosterRow) was its last use.

b. Delete the `<CapacityPanel groups={data.groups} />` line.

c. After the `filtered` memo, add the roster assembly:

```ts
  const roster = useMemo(() => {
    const orphan = filtered.find((g) => g.isOrphan);
    const engineers = filtered.filter((g) => !g.isOrphan);
    const working = engineers
      .filter((g) => g.visibleStories.length > 0)
      .sort(
        (a, b) =>
          b.totals.inProgressCount - a.totals.inProgressCount ||
          b.totals.activeHoursAssigned - a.totals.activeHoursAssigned,
      );
    // Engineers with no visible stories under the current filter + assignable
    // people who have no story group at all — folded into one "free" row.
    const groupIds = new Set(engineers.map((g) => g.id));
    const free: { id: string; name: string; role: string | null }[] = [
      ...engineers
        .filter((g) => g.visibleStories.length === 0)
        .map((g) => ({ id: g.id, name: g.name, role: g.role })),
      ...data.assignablePeople
        .filter((p) => !groupIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, role: p.role })),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const maxAssigned = Math.max(
      ...working.map((g) => g.totals.activeHoursAssigned),
      1,
    );
    return { orphan, working, free, maxAssigned };
  }, [filtered, data.assignablePeople]);
```

d. Replace the whole "Engineer sections" block (the `filtered.map(...)` list, including the collapsed-section markup and per-engineer mini-strip) with:

```tsx
      {/* Unified roster */}
      <div className="space-y-3">
        {roster.orphan && roster.orphan.visibleStories.length > 0 && (
          <RosterRow
            group={roster.orphan}
            stories={roster.orphan.visibleStories}
            maxAssigned={roster.maxAssigned}
            expanded={!collapsed.has("__orphan__")}
            onToggle={() => toggleCollapse("__orphan__")}
            selectedId={selected?.id ?? null}
            onSelectStory={setSelected}
          />
        )}

        {roster.working.map((g) => (
          <RosterRow
            key={g.id}
            group={g}
            stories={g.visibleStories}
            maxAssigned={roster.maxAssigned}
            expanded={!collapsed.has(g.id)}
            onToggle={() => toggleCollapse(g.id)}
            selectedId={selected?.id ?? null}
            onSelectStory={setSelected}
          />
        ))}

        {roster.working.length === 0 && !roster.orphan && (
          <div className="text-center py-12 text-ink-muted text-[13px]">
            No stories match the current filter.
          </div>
        )}

        {roster.free.length > 0 && !filter.orphanOnly && (
          <section className="bg-surface border border-rule rounded-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCollapse("__free__")}
              className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-bg-elevated transition-colors"
            >
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-ink-strong">
                  {roster.free.length} engineer{roster.free.length === 1 ? "" : "s"} free
                </span>
                <span className="ml-2 text-[12px] text-ink-muted truncate">
                  {roster.free.map((p) => p.name).join(" · ")}
                </span>
              </div>
              <span className="text-ink-faint text-[14px] font-mono w-3 shrink-0">
                {collapsed.has("__free__") ? "+" : "−"}
              </span>
            </button>
            {!collapsed.has("__free__") && (
              <div className="border-t border-rule divide-y divide-rule">
                {roster.free.map((p) => (
                  <div
                    key={p.id}
                    className="px-5 py-2.5 flex items-center justify-between gap-4 text-[12px]"
                  >
                    <div className="min-w-0">
                      <span className="text-ink-strong font-medium">{p.name}</span>
                      <span className="ml-2 text-ink-muted">{p.role ?? "Engineer"}</span>
                      <span className="ml-2 text-ink-faint">· no active stories</span>
                    </div>
                    <Link
                      href={`/me?as=${p.id}`}
                      className="text-emerald hover:text-emerald/80 transition-colors font-mono text-[11px] whitespace-nowrap"
                    >
                      View scorecard →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
```

Note: the free-row list uses `Link` — keep the `Link` import in the board.

e. Seed the collapse default so the free row starts collapsed:

```ts
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["__free__"]));
```

- [ ] **Step 3: Delete CapacityPanel**

```bash
rm components/engineering/CapacityPanel.tsx
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → exit 0.
On `/engineering`:
- One roster: Unassigned first (red accent, "Triage →" inside), then working engineers ordered by doing-count, then one "N engineers free" collapsed row that expands to name rows.
- No Capacity Planning panel; no duplicate list.
- Expanding a row shows the story **table**; clicking a row opens the StorySheet; assign/edit still work (admin dev session).
- No "Worked" numbers anywhere on the board.
- Unassigned KPI card click → only the Unassigned row shows; click again → full roster.
- Filter to a client with one engineer → other engineers fold into the free row, not vanish.

- [ ] **Step 5: Commit**

```bash
git add components/engineering/EngineeringBoard.tsx components/engineering/RosterRow.tsx
git rm components/engineering/CapacityPanel.tsx
git commit -m "Merge capacity panel and engineer sections into unified roster with story tables"
```

---

### Task 5: Sticky filter bar + final placement

**Files:**
- Modify: `components/engineering/EngineeringBoard.tsx` (wrap FilterBar in sticky container)
- Modify: `components/engineering/FilterBar.tsx:43` (root spacing handled by wrapper)

**Interfaces:**
- Consumes: TopBar constraint — `sticky top-0 z-30 h-12` on `md+`, absent below `md`.
- Produces: filter bar sticks below the TopBar while the roster scrolls.

- [ ] **Step 1: Remove FilterBar's own margin**

In `FilterBar.tsx`, change the root `<div className="mb-4">` to `<div>`.

- [ ] **Step 2: Sticky wrapper in the board**

In `EngineeringBoard.tsx`, wrap the `<EngineeringFilterBar ... />` call:

```tsx
      <div className="sticky top-0 md:top-12 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-bg/95 backdrop-blur border-b border-rule-soft">
        <EngineeringFilterBar
          filter={filter}
          setFilter={setFilter}
          engineers={engineersWithWork}
          clients={data.clients}
          sprints={data.sprints}
          totalStories={data.totals.totalStories}
          filteredCount={filteredCount}
        />
      </div>
```

(`-mx-4 sm:-mx-6` bleeds the backdrop to the page padding edges so roster content doesn't peek around it while scrolling — this is what the broken redo got wrong.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → exit 0.
On `/engineering` (desktop): scroll deep into the roster → filter bar pins below the TopBar, no content bleeding above/behind it, no flicker band; dropdowns open correctly while pinned. Narrow the window below `md` → bar pins to the very top.

- [ ] **Step 4: Commit**

```bash
git add components/engineering/EngineeringBoard.tsx components/engineering/FilterBar.tsx
git commit -m "Make engineering filter bar sticky under the top bar"
```

---

### Task 6: Full verification pass

**Files:**
- None (verification only; fix-forward anything found, amend the relevant commit or add a fix commit).

- [ ] **Step 1: Typecheck + build**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run build` → exit 0; confirm the `/engineering` route bundle didn't balloon (compare First Load JS against neighboring routes in the build output).

- [ ] **Step 2: Click-through checklist on http://localhost:3002/engineering**

- KPI cards: values sane; Unassigned + QA queue toggle their filters and show `active` styling.
- Filters: each of search / status / engineer / client / sprint / priority narrows the list; combined filters work; URL params round-trip on reload (`?priority=High&status=todo` seeds the UI); Clear resets.
- Roster: order = Unassigned → most-doing → free row; expand/collapse persists while filtering; free row expands to scorecard links.
- Story table: desktop shows 7 columns; row click opens StorySheet; editing (status/assignee) works with the dev admin session and the roster refreshes after `revalidateTag`.
- Mobile width (~390px): stacked story rows readable, KPI grid 2-up, filter bar wraps, sticky works without TopBar offset.
- `/me` page still renders StoryCards (badge extraction regression check).

- [ ] **Step 3: Report**

Summarize element-by-element what changed against the spec's five moves; note anything deferred.

---

## Self-Review (completed)

- **Spec coverage:** Move 1 → Task 4; Move 2 → Tasks 3+4 (worked/over-budget displays never re-created in RosterRow/StoryTable); Move 3 → Tasks 1 (controls removed) + 3 (KPI stays clickable) + 4 (pinned row + Triage link); Move 4 → Tasks 1 (Priority) + 5 (sticky, placement); Move 5 + story-table addendum → Tasks 2+4; KPI adjustments → Task 3. ✓
- **Placeholder scan:** no TBDs; all code blocks are complete implementations. ✓
- **Type consistency:** `Filter.priority: string | null` (Tasks 1/2/4 agree); `StoryTable` props `{stories, selectedId, onSelect}` match between Tasks 2 and 4; `RosterRow` consumes `visibleStories` computed in the existing `filtered` memo; `collapsed` semantics inverted correctly (`expanded={!collapsed.has(id)}`). ✓
