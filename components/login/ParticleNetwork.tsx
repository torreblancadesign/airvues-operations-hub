"use client";

// Canvas-based "plexus" effect — drifting particles with lines connecting
// neighbors within a threshold distance. Pure 2D canvas, ~5 KB, brand-tuned.
// Pauses when the tab is hidden; respects prefers-reduced-motion.

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

// Brand-tuned palette
const COLORS = {
  node: "rgba(34, 211, 168, 0.85)",     // emerald
  nodeAlt: "rgba(125, 211, 252, 0.6)",  // sky tint (every 4th particle)
  line: "rgba(34, 211, 168, ",          // emerald, alpha appended per frame
} as const;

const CONFIG = {
  density: 14000,         // 1 particle per N pixels of canvas area (lower = more particles)
  maxParticles: 120,      // hard cap for very large screens
  minSpeed: 0.05,
  maxSpeed: 0.25,
  linkDistance: 140,      // px — particles within this distance get a line
  cursorRadius: 180,      // px — pointer attraction halo
  cursorStrength: 0.05,
};

export function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return; // honor accessibility — keep canvas blank

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x for perf
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedParticles();
    };

    const seedParticles = () => {
      const count = Math.min(
        CONFIG.maxParticles,
        Math.floor((width * height) / CONFIG.density),
      );
      const ps: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = CONFIG.minSpeed + Math.random() * (CONFIG.maxSpeed - CONFIG.minSpeed);
        ps.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 1 + Math.random() * 1.3,
        });
      }
      particlesRef.current = ps;
    };

    const tick = () => {
      const ps = particlesRef.current;
      ctx.clearRect(0, 0, width, height);

      // Update positions
      for (const p of ps) {
        // Subtle cursor attraction
        if (pointerRef.current.active) {
          const dx = pointerRef.current.x - p.x;
          const dy = pointerRef.current.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONFIG.cursorRadius) {
            const pull = (1 - dist / CONFIG.cursorRadius) * CONFIG.cursorStrength;
            p.vx += (dx / (dist || 1)) * pull;
            p.vy += (dy / (dist || 1)) * pull;
          }
        }

        p.x += p.vx;
        p.y += p.vy;

        // Soft velocity damping so cursor pulls don't snowball
        p.vx *= 0.995;
        p.vy *= 0.995;

        // Wrap around edges
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
      }

      // Draw lines first (under the nodes)
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONFIG.linkDistance) {
            const alpha = (1 - dist / CONFIG.linkDistance) * 0.35;
            ctx.strokeStyle = `${COLORS.line}${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        ctx.fillStyle = i % 4 === 0 ? COLORS.nodeAlt : COLORS.node;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    // Pause when the tab is hidden — saves CPU/battery
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = e.clientX - rect.left;
      pointerRef.current.y = e.clientY - rect.top;
      pointerRef.current.active = true;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      aria-hidden="true"
    />
  );
}
