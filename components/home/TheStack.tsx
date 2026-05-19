// External tools the Airvues team lives in. Static list — edit here when you change tools.

const TOOLS = [
  {
    name: "Airtable",
    desc: "Operational base",
    href: `https://airtable.com/${process.env.AIRTABLE_BASE_ID ?? ""}`,
    glyph: "▦",
    tone: "emerald" as const,
  },
  {
    name: "Slack",
    desc: "Team comms",
    href: "https://app.slack.com/client",
    glyph: "#",
    tone: "violet" as const,
  },
  {
    name: "GitHub",
    desc: "airvues-ops org",
    href: "https://github.com/airvues-ops",
    glyph: "⌂",
    tone: "sky" as const,
  },
  {
    name: "Vercel",
    desc: "Deploys + logs",
    href: "https://vercel.com/airvues1s-projects",
    glyph: "▲",
    tone: "neutral" as const,
  },
  {
    name: "Stripe",
    desc: "Invoicing + payouts",
    href: "https://dashboard.stripe.com/",
    glyph: "$",
    tone: "violet" as const,
  },
  {
    name: "Google Workspace",
    desc: "Mail · Drive · Cal",
    href: "https://mail.google.com/",
    glyph: "G",
    tone: "amber" as const,
  },
  {
    name: "PandaDoc",
    desc: "Offers + contracts",
    href: "https://app.pandadoc.com/",
    glyph: "P",
    tone: "emerald" as const,
  },
  {
    name: "Granola",
    desc: "Meeting notes",
    href: "https://app.granola.ai/",
    glyph: "◐",
    tone: "sky" as const,
  },
  {
    name: "Loom",
    desc: "Walkthrough videos",
    href: "https://www.loom.com/my-videos",
    glyph: "○",
    tone: "violet" as const,
  },
  {
    name: "Airvues Mobile",
    desc: "mobile.airvues.com",
    href: "https://mobile.airvues.com",
    glyph: "A",
    tone: "emerald" as const,
  },
  {
    name: "Quote Viewer",
    desc: "airvues-quote.vercel.app",
    href: "https://airvues-quote.vercel.app",
    glyph: "Q",
    tone: "neutral" as const,
  },
  {
    name: "Airvues.com",
    desc: "Brand site",
    href: "https://airvues.com",
    glyph: "✦",
    tone: "amber" as const,
  },
];

const TONE_BG: Record<string, string> = {
  emerald: "bg-emerald/10 text-emerald border-emerald/30",
  amber: "bg-amber/10 text-amber border-amber/30",
  red: "bg-red/10 text-red border-red/30",
  sky: "bg-sky/10 text-sky border-sky/30",
  violet: "bg-violet/10 text-violet border-violet/30",
  neutral: "bg-bg-elevated text-ink-strong border-rule-strong",
};

export function TheStack() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {TOOLS.map((t) => (
        <a
          key={t.name}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative bg-surface border border-rule rounded-card p-4 hover:border-emerald/40 hover:-translate-y-px hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5),0_0_18px_-8px_rgba(34,211,168,0.2)] transition-all duration-200 overflow-hidden"
        >
          <div className="flex items-start gap-3 mb-3">
            <div
              className={`w-9 h-9 rounded-md border flex items-center justify-center text-[15px] font-semibold shrink-0 ${TONE_BG[t.tone]}`}
              aria-hidden="true"
            >
              {t.glyph}
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ink-faint group-hover:text-emerald ml-auto mt-1 transition-colors"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </div>
          <div className="text-[13px] font-semibold text-ink-strong leading-none mb-1 group-hover:text-emerald transition-colors">
            {t.name}
          </div>
          <div className="text-[11px] text-ink-muted leading-snug">{t.desc}</div>
        </a>
      ))}
    </div>
  );
}
