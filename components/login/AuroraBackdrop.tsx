import { ParticleNetwork } from "./ParticleNetwork";

export function AuroraBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Soft aurora glow underneath */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="aurora-blob aurora-blob-emerald" />
        <div className="aurora-blob aurora-blob-navy" />
        <div className="aurora-blob aurora-blob-deep" />
      </div>
      {/* Particle network in the middle layer — captures pointer events for cursor attraction */}
      <ParticleNetwork />
      {/* Texture + edge fade on top */}
      <div className="aurora-grain pointer-events-none" />
      <div className="aurora-vignette pointer-events-none" />
    </div>
  );
}
