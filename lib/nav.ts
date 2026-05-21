// Single source of truth for the dashboard's nav structure.
// Consumed by Sidebar (desktop), MobileNav (drawer), and the home page Jump-To cards.
// Add a new route here and it appears in all three.

export type NavItem = {
  href: string;
  label: string;
  desc?: string;
  showInSidebar: boolean;
  showOnHome: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    desc: "KPIs · 2026 goals · jump-to all pages",
    showInSidebar: true,
    showOnHome: false,
  },
  {
    href: "/me",
    label: "My Scorecard",
    desc: "Personal commission · bonus tracker · next to ship · all your stories",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/money",
    label: "Earnings",
    desc: "Invoices · AR aging · MRR · top clients · drill into each record",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/leads",
    label: "Leads",
    desc: "Inbound demand · intro meetings · funnel · YTD/MTD",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/pipeline",
    label: "Sales Pipeline",
    desc: "Stalled quotes · funnel · goal tracker · stage breakdown",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/engineering",
    label: "Engineering",
    desc: "Stories by engineer · leaderboard · commission tracker",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/backlog",
    label: "Backlog",
    desc: "Refinement · bulk-triage · inline edits · new story",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/sprints",
    label: "Sprints",
    desc: "Kanban boards · velocity · planning · new sprint",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/clients",
    label: "Clients",
    desc: "Active · at-risk · retainer tier · concentration risk",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/team",
    label: "Team",
    desc: "Headcount · unrouted payments · onboarding pipeline",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/stack",
    label: "Stack",
    desc: "Internal SaaS subscriptions · burn rate · cadence",
    showInSidebar: true,
    showOnHome: true,
  },
  {
    href: "/hygiene",
    label: "Hygiene",
    desc: "Data quality blockers · orphan triage · stale quotes",
    showInSidebar: true,
    showOnHome: true,
  },
];
