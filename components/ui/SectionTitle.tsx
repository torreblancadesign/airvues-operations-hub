// Compact section heading — small label, optional right aside.

type Props = {
  title: string;
  aside?: React.ReactNode;
};

export function SectionTitle({ title, aside }: Props) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[13px] font-semibold text-ink-strong uppercase tracking-wider">
        {title}
      </h2>
      {aside && <div className="text-[12px] text-ink-muted">{aside}</div>}
    </div>
  );
}
