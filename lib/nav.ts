// Single source of truth for the dashboard's nav structure.
// Consumed by Sidebar (desktop), MobileNav (drawer), and the home page Jump-To cards.
// Add a new route here and it appears in all three.
//
// Tab structure follows the Airvues One blueprint (2026-06):
// Overview · Accounts · Projects · Stories · Earnings · Operations · Founder.
// Leads + Clients are unified under Accounts. Pipeline → Projects (rename only; route stays /pipeline).

export type NavGroup =
  | "overview"
  | "delivery"
  | "engineering"
  | "earnings"
  | "operations"
  | "founder";

export type NavItem = {
  href: string;
  label: string;
  desc?: string;
  group: NavGroup;
  showInSidebar: boolean;
  showOnHome: boolean;
};

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "delivery", label: "Delivery" },
  { id: "engineering", label: "Engineering" },
  { id: "earnings", label: "Earnings" },
  { id: "operations", label: "Operations" },
  { id: "founder", label: "Founder" },
];

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    desc: "KPIs · 2026 goals · jump-to all pages",
    group: "overview",
    showInSidebar: true,
    showOnHome: false,
  },
  {
    href: "/me",
    label: "My Scorecard",
    desc: "Personal commission · bonus tracker · next to ship · all your stories",
    group: "overview",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/loops",
    label: "Loops",
    desc: "Record your screen + mic · share a link · no Loom seats",
    group: "overview",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/meetings",
    label: "Meetings",
    desc: "Recorded calls · AI transcripts · decisions · action items",
    group: "overview",
    showInSidebar: true,
    showOnHome: true,
  },

  // Accounts (unified Leads + Clients)
  {
    href: "/clients",
    label: "Accounts",
    desc: "Leads, partners, clients · status, proposals, projects, invoices",
    group: "delivery",
    showInSidebar: true,
    showOnHome: true,
  },
  // Legacy Leads route — hidden from nav, kept for one deploy cycle as fallback.
  {
    href: "/leads",
    label: "Leads (legacy)",
    desc: "Pre-unification leads view — superseded by Accounts",
    group: "delivery",
    showInSidebar: false,
    showOnHome: false,
  },

  // Projects (renamed from Sales Pipeline; route stays /pipeline to avoid breaking links)
  {
    href: "/pipeline",
    label: "Projects",
    desc: "All projects · sent · in progress · deadlines · stage breakdown",
    group: "delivery",
    showInSidebar: true,
    showOnHome: true,
  },

  // Stories umbrella
  {
    href: "/engineering",
    label: "Engineering",
    desc: "Stories by engineer · leaderboard · commission tracker",
    group: "engineering",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/backlog",
    label: "Backlog",
    desc: "Refinement · bulk-triage · inline edits · new story",
    group: "engineering",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/sprints",
    label: "Sprints",
    desc: "Kanban boards · velocity · planning · new sprint",
    group: "engineering",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/engineering/retainer-timesheets",
    label: "Retainer Timesheets",
    desc: "Log stories against any active retainer · monthly grouping · tag totals",
    group: "engineering",
    showInSidebar: true,
    showOnHome: true,
  },


  // Earnings
  {
    href: "/money",
    label: "Earnings",
    desc: "Invoices · AR aging · MRR · top clients · drill into each record",
    group: "earnings",
    showInSidebar: true,
    showOnHome: true,
  },

  // Operations
  {
    href: "/team",
    label: "Team",
    desc: "Headcount · unrouted payments · onboarding pipeline",
    group: "operations",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/stack",
    label: "Stack",
    desc: "Internal SaaS subscriptions · burn rate · cadence",
    group: "operations",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/hygiene",
    label: "Hygiene",
    desc: "Data quality blockers · orphan triage · stale quotes",
    group: "operations",
    showInSidebar: true,
    showOnHome: true,
  },

  {
    href: "/founder",
    label: "Founder Dashboard",
    desc: "Path to replacement income · monthly goal · earnings projection",
    group: "founder",
    showInSidebar: true,
    showOnHome: false,
  },
];
