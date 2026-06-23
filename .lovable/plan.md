## Goal

Restructure sidebar groups and permissions so:
- **Revenue** permission unlocks only **Earnings** (`/money`).
- **Delivery** permission unlocks the new combined **Delivery** group (`/clients` + `/pipeline`) as well as the existing **Stories** group.
- All other groups (Overview, Operations, Founder) unchanged.

## New group → permission map

| Sidebar group | Required permission | Routes |
|---|---|---|
| Overview | none | `/`, `/me`, `/loops`, `/meetings` |
| **Delivery** (new, combined) | **Delivery** | `/clients`, `/pipeline` |
| Stories | Delivery | `/engineering`, `/backlog`, `/sprints` |
| **Earnings** | **Revenue** | `/money` |
| Operations | Operations | `/team`, `/stack`, `/hygiene` |
| Founder | Founder | `/founder` |

The `Accounts` and `Projects` groups are removed; their items move into the new `Delivery` group.

## Changes

### 1. `lib/nav.ts`
- Replace `NavGroup` union: drop `"accounts"` and `"projects"`, add `"delivery"`. Keep `"stories"`, `"earnings"`, `"overview"`, `"operations"`, `"founder"`.
- `NAV_GROUPS` becomes: Overview · Delivery · Stories · Earnings · Operations · Founder.
- Update `NAV_ITEMS`:
  - `/clients` → `group: "delivery"` (label stays "Accounts")
  - `/leads` (legacy, hidden) → `group: "delivery"`
  - `/pipeline` → `group: "delivery"` (label stays "Projects")
  - Everything else unchanged.

### 2. `lib/permissions.ts`
- `GROUP_PERMISSION`:
  - Remove `accounts`, `projects`.
  - Add `delivery: "Delivery"`.
  - `stories: "Delivery"` unchanged.
  - `earnings: "Revenue"` unchanged.
- `ROUTE_PERMISSION`:
  - `clients: "Delivery"` (was Revenue)
  - `pipeline: "Delivery"` (was Revenue)
  - `leads: "Delivery"` (was Revenue)
  - `money: "Revenue"` unchanged.

### 3. Verify
- `npx tsc --noEmit` (NavGroup is a string-literal union; both files must agree).
- Spot-check sidebar: user with only `Revenue` sees just Earnings; user with only `Delivery` sees the new Delivery group + Stories; combined permissions see both.

## Out of scope

- No changes to data layers, mutations, route paths, or page contents.
- Stories group label/contents unchanged.
- Mutation gating (`requireRole`) unchanged — this is view-only permission wiring.
