// Four principles cross-fade on a 32-second loop. Pure CSS — no JS.
// Each principle is visible for ~6s with a 2s fade in/out, staggered 8s apart.

const PRINCIPLES = [
  "Systems that survive reality.",
  "Clarity before complexity.",
  "Architecture matters.",
  "Built to outlast.",
];

export function Manifesto() {
  return (
    <div className="manifesto" aria-label="Airvues principles">
      {PRINCIPLES.map((line, i) => (
        <span
          key={i}
          className="manifesto-line"
          style={{ animationDelay: `${i * 8}s` }}
        >
          {line}
        </span>
      ))}
    </div>
  );
}
