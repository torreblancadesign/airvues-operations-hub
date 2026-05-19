type Props = {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
};

export function PageHeader({ title, subtitle, meta }: Props) {
  return (
    <header className="relative mb-6 pb-4 border-b border-rule">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[20px] font-semibold text-ink-strong leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-ink-muted mt-1 max-w-2xl">{subtitle}</p>
          )}
        </div>
        {meta && (
          <div className="text-right text-[12px] text-ink-muted leading-snug shrink-0">{meta}</div>
        )}
      </div>
      {/* Hairline emerald gradient at the bottom — same accent as the login card top */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(34, 211, 168, 0.45), transparent 50%)",
        }}
        aria-hidden="true"
      />
    </header>
  );
}
