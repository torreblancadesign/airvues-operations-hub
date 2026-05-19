import Link from "next/link";

type Props = {
  href: string;
  title: string;
  desc: string;
};

export function HomeJumpCard({ href, title, desc }: Props) {
  return (
    <Link
      href={href}
      className="block bg-surface border border-rule rounded-card p-4 hover:border-rule-strong transition-colors"
    >
      <div className="text-[14px] font-semibold text-ink-strong mb-1">{title}</div>
      <div className="text-[12px] text-ink-muted leading-snug">{desc}</div>
      <div className="mt-3 text-[11px] font-mono text-emerald">Open →</div>
    </Link>
  );
}
