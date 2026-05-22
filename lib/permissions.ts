// View-only permission gating driven by the People.Permissions multi-select.
// Mutations are still gated by requireRole(...) — these are for navigation,
// page access, and conditional UI sections only.
import type { AppRole } from "./auth";
import type { NavGroup } from "./nav";

export type Permission =
  | "Revenue"
  | "Delivery"
  | "Operations"
  | "Home - Firm Pulse"
  | "Scorecard - Admin";

export const ALL_PERMISSIONS: Permission[] = [
  "Revenue",
  "Delivery",
  "Operations",
  "Home - Firm Pulse",
  "Scorecard - Admin",
];

// Map nav groups to the permission that unlocks them. Overview is always open.
const GROUP_PERMISSION: Partial<Record<NavGroup, Permission>> = {
  revenue: "Revenue",
  delivery: "Delivery",
  operations: "Operations",
};

// Map first path segment → permission. Routes not in this map (e.g. "/", "/me")
// are always accessible.
const ROUTE_PERMISSION: Record<string, Permission> = {
  leads: "Revenue",
  pipeline: "Revenue",
  money: "Revenue",
  clients: "Revenue",
  engineering: "Delivery",
  backlog: "Delivery",
  sprints: "Delivery",
  team: "Operations",
  stack: "Operations",
  hygiene: "Operations",
};

// Admin role bypasses all permission checks.
// View permissions are driven entirely by People.Permissions. Auth role
// (admin/lead/etc.) only governs mutations via requireRole(). An admin who
// is not granted a view permission should not see that section.

export function hasPermission(
  perms: Permission[] | null | undefined,
  p: Permission,
  _role?: AppRole | null,
): boolean {
  return Array.isArray(perms) && perms.includes(p);
}

export function canAccessGroup(
  perms: Permission[] | null | undefined,
  group: NavGroup,
  _role?: AppRole | null,
): boolean {
  const required = GROUP_PERMISSION[group];
  if (!required) return true; // overview etc.
  return Array.isArray(perms) && perms.includes(required);
}

function firstSegment(href: string): string {
  const trimmed = href.replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.split("/")[0].split("?")[0];
}

export function canAccessRoute(
  perms: Permission[] | null | undefined,
  href: string,
  _role?: AppRole | null,
): boolean {
  const seg = firstSegment(href);
  if (!seg) return true; // home
  const required = ROUTE_PERMISSION[seg];
  if (!required) return true; // /me and anything else not gated
  return Array.isArray(perms) && perms.includes(required);
}

export function canSwitchScorecard(
  perms: Permission[] | null | undefined,
  role?: AppRole | null,
): boolean {
  return hasPermission(perms, "Scorecard - Admin", role);
}

export function canSeeFirmPulse(
  perms: Permission[] | null | undefined,
  role?: AppRole | null,
): boolean {
  return hasPermission(perms, "Home - Firm Pulse", role);
}

