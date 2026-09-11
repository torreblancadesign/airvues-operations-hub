// View-only permission gating driven by the People.Permissions multi-select.
// Mutations are still gated by requireRole(...) — these are for navigation,
// page access, and conditional UI sections only.
import type { AppRole } from "./auth";
import type { NavGroup } from "./nav";

export type Permission =
  | "Revenue"
  | "Delivery"
  | "Engineering"
  | "Operations"
  | "Home - Firm Pulse"
  | "Scorecard - Admin"
  | "Founder";

export const ALL_PERMISSIONS: Permission[] = [
  "Revenue",
  "Delivery",
  "Engineering",
  "Operations",
  "Home - Firm Pulse",
  "Scorecard - Admin",
  "Founder",
];

// Map nav groups to the permission that unlocks them. Overview is always open.
// Post 2026-06 nav restructure: revenue/delivery groups split into
// accounts/projects/stories/earnings — all still gated by Revenue/Delivery.
const GROUP_PERMISSION: Partial<Record<NavGroup, Permission>> = {
  delivery: "Delivery",
  engineering: "Engineering",
  earnings: "Revenue",
  operations: "Operations",
  founder: "Founder",
};

// Map first path segment → permission. Routes not in this map (e.g. "/", "/me")
// are always accessible.
const ROUTE_PERMISSION: Record<string, Permission> = {
  leads: "Delivery",
  pipeline: "Delivery",
  clients: "Delivery",
  // Retainers rides on Delivery rather than a dedicated permission: a new
  // People.Permissions option would leave the page invisible to everyone until
  // each manager's Airtable record is edited. Split it out later if needed.
  retainers: "Delivery",
  money: "Revenue",
  engineering: "Engineering",
  backlog: "Engineering",
  sprints: "Engineering",
  team: "Operations",
  stack: "Operations",
  hygiene: "Operations",
  // The page itself is also role-gated to admin/lead (canDelete) — the
  // permission only decides who sees the nav link.
  archive: "Operations",
  founder: "Founder",
};

// Admin role bypasses all permission checks.
// View permissions are driven entirely by People.Permissions. Auth role
// (admin/lead/etc.) only governs mutations via requireRole(). An admin who
// is not granted a view permission should not see that section.

// Roles allowed to delete or archive records. Client-safe so the nav can hide
// what a viewer cannot use; lib/authz.ts imports the same list for the real
// server-side gate (deleteGate).
export const DELETE_ROLES: AppRole[] = ["admin", "lead", "editor"];

export function canRoleDelete(role: AppRole | null | undefined): boolean {
  return !!role && DELETE_ROLES.includes(role);
}

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

