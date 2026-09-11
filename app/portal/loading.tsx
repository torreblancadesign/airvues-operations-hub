// Instant feedback on navigation.
//
// Without this, every portal route is dynamic with no fallback, so clicking a
// link paints nothing until the server responds — which reads as the app
// having hung rather than having started. The skeleton mirrors the real
// layout's measure so nothing jumps when the content lands.
function Bar({ w, h = 12 }: { w: string; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: "var(--p-line)",
        opacity: 0.85,
      }}
    />
  );
}

export default function PortalLoading() {
  return (
    <div className="p-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Bar w="140px" h={24} />
      <div style={{ height: 8 }} />
      <Bar w="230px" h={12} />

      <div className="p-hero mt-6 p-6 sm:p-7">
        <Bar w="150px" h={11} />
        <div style={{ height: 16 }} />
        <Bar w="120px" h={44} />
        <div style={{ height: 20 }} />
        <Bar w="min(420px, 100%)" h={8} />
      </div>

      <div style={{ height: 32 }} />
      <Bar w="110px" h={16} />
      <div style={{ height: 12 }} />
      <div className="p-panel">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-row" style={{ pointerEvents: "none" }}>
            <div className="flex-1">
              <Bar w={`${58 - i * 9}%`} h={13} />
              <div style={{ height: 8 }} />
              <Bar w={`${34 - i * 5}%`} h={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
