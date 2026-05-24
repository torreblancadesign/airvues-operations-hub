// Single source of truth for the dashboard's nav structure.
// Consumed by Sidebar (desktop), MobileNav (drawer), and the home page Jump-To cards.
// Add a new route here and it appears in all three.

export type NavGroup = "overview" | "revenue" | "delivery" | "operations" | "founder";

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
  { id: "revenue", label: "Revenue" },
  { id: "delivery", label: "Delivery" },
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
    href: "/leads",
    label: "Leads",
    desc: "Inbound demand · intro meetings · funnel · YTD/MTD",
    group: "revenue",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/pipeline",
    label: "Sales Pipeline",
    desc: "Stalled quotes · funnel · goal tracker · stage breakdown",
    group: "revenue",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/money",
    label: "Earnings",
    desc: "Invoices · AR aging · MRR · top clients · drill into each record",
    group: "revenue",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/clients",
    label: "Clients",
    desc: "Active · at-risk · retainer tier · concentration risk",
    group: "revenue",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/engineering",
    label: "Engineering",
    desc: "Stories by engineer · leaderboard · commission tracker",
    group: "delivery",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/backlog",
    label: "Backlog",
    desc: "Refinement · bulk-triage · inline edits · new story",
    group: "delivery",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/sprints",
    label: "Sprints",
    desc: "Kanban boards · velocity · planning · new sprint",
    group: "delivery",
    showInSidebar: true,
    showOnHome: true,
  },
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
];
