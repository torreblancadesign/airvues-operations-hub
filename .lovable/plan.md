## Founder Dashboard — /founder

A private, admin-only page that translates monthly revenue into projected founder replacement income and tracks progress to a $115K/mo goal.

### Routing & access

- New route: `app/(app)/founder/page.tsx` (Server Component).
- Add to `lib/nav.ts` as a brand-new nav group `"founder"` (label "Founder") so it sits in its own section in the Sidebar / MobileNav / Home jump-cards. Single entry: `{ href: "/founder", label: "Founder Dashboard", group: "founder", showInSidebar: true, showOnHome: false }`.
- Access gating (defense in depth, matching existing patterns):
  1. Page top: `await requireRole("admin")` — hard server-side gate. Non-admins get redirected/error (use the same try/catch + `redirect("/")` shape used elsewhere when convenient, or let AuthzError bubble).
  2. Add a new `Permission` value `"Founder"` to `lib/permissions.ts` and map `founder: "Founder"` in `ROUTE_PERMISSION` + a new `GROUP_PERMISSION.founder = "Founder"` so the nav item is hidden from anyone without the Founder permission, even if somehow admin. This mirrors how Revenue/Delivery/Operations are gated.
  3. Founders get the `"Founder"` permission added to their People.Permissions multi-select in Airtable (one-time, manual — call out in delivery notes).

### Data

- Current month revenue comes from `revenueMtd()` in `lib/kpi.ts` (already exists, cached, paid invoices MTD). Pass `kpi.value ?? 0` to the client.
- No new Airtable reads. No mutations. No schema changes.
- All projection math runs in the client so assumptions sliders feel instant.

### File layout

```
app/(app)/founder/page.tsx          Server component: requireRole("admin"),
                                    fetches revenueMtd(), renders <FounderDashboard
                                    currentMonthRevenue=... />
components/founder/FounderDashboard.tsx   Client component, owns assumptions state +
                                          editable Current Month Revenue override
components/founder/types.ts         Assumptions type + default constants
lib/founder-math.ts                 Pure helpers: monthlyProfit, founderMonthly,
                                    founderAnnual, given assumptions
lib/nav.ts                          + new "founder" group + nav item
lib/permissions.ts                  + "Founder" permission, route + group mapping
```

### Component breakdown (single client component, internally sectioned)

1. **Path to Founder Replacement Income** — big hero card. Uses existing `GoalBar` (`components/home/GoalBar.tsx`) with `value=currentMonthRevenue`, `target=monthlyGoal`, currency formatter. Shows current / goal / progress % / remaining.
2. **Founder Earnings Projection** (current pace) — KPI card grid using `StatCard`: monthly revenue, monthly profit, ownership %, founder monthly, founder annualized. Tag-line: "Based on the current monthly revenue pace…".
3. **Goal Earnings** card — same shape, computed at `monthlyGoal`. Includes the tax/structure caveat note.
4. **Gap to Replacement Income** card — current annualized vs goal annualized, delta, additional monthly revenue needed (= goal - current revenue, floored at 0).
5. **Revenue Scenario Table** — rows $40K / 50K / 75K / 100K / 115K / 130K / 150K with profit, founder monthly, founder annualized, progress to goal. Tabular numbers, monospace, highlight the row closest to current revenue.
6. **Assumptions panel** — collapsible card at the bottom with number inputs for: monthly goal, founder ownership %, engineer commission %, Shania commission %, fixed team cost, software/overhead. Editing any value live-updates all the cards + table (React state, no persistence — call out as v1 limitation).
7. **Current Month Revenue override** — small inline edit affordance on the hero card: defaults to `revenueMtd` value; if zero or admin wants to model, they can override locally. State only.

### Design

- Reuse `PageHeader`, `SectionTitle`, `StatCard`, `GoalBar`, surface/rule tokens — matches the rest of the app's dark, JetBrains-Mono-numerics look.
- Layout: hero card full-width; projection + goal earnings side-by-side on `md:`; gap card full-width; scenario table full-width; assumptions panel full-width collapsible.
- Currency: `Intl.NumberFormat USD, maximumFractionDigits: 0`. Percent: one decimal place per spec.

### Formulas (centralized in `lib/founder-math.ts`)

```
variableRate     = engineerCommission + shaniaCommission   // default 0.325
fixedMonthly     = teamCost + overhead                     // default 12000
monthlyProfit    = revenue * (1 - variableRate) - fixedMonthly
founderMonthly   = monthlyProfit * founderOwnership
founderAnnual    = founderMonthly * 12
progressToGoal   = revenue / monthlyGoal
```

Defaults match the spec exactly ($115K, 0.60, 0.225, 0.10, $11K, $1K).

### Out of scope (v1)

- Persisting assumption tweaks to Airtable or env (state lives in React only).
- Historical revenue trend chart.
- Tax modeling.
- Showing on /home or any non-founder surface.

### Verification

- `npx tsc --noEmit` + `npm run build` both clean.
- As an admin user: `/founder` renders, current MTD revenue prefilled, sliders update everything live.
- As a non-admin (engineer/client): `/founder` redirects, and the nav item is not visible in Sidebar/MobileNav.
- Hand-check the worked examples in the spec ($40K → $108K annualized; $115K → $472,500 annualized).
