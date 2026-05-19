"use client";

import { useEffect, useRef, useState } from "react";

export type TickerFormat = "currency" | "percent" | "number";

const FORMATTERS: Record<TickerFormat, (n: number) => string> = {
  currency: (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n),
  percent: (n) => `${Math.round(n)}%`,
  number: (n) => new Intl.NumberFormat("en-US").format(Math.round(n)),
};

type Props = {
  value: number;
  format: TickerFormat;
  duration?: number;
  delay?: number;
};

// Eases the count-up so the tail feels weighty rather than abrupt.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function NumberTicker({ value, format, duration = 900, delay = 0 }: Props) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }

    setDisplay(0);
    const timer = window.setTimeout(() => {
      const step = (ts: number) => {
        if (!startedAtRef.current) startedAtRef.current = ts;
        const elapsed = ts - startedAtRef.current;
        const progress = Math.min(1, elapsed / duration);
        const eased = easeOut(progress);
        setDisplay(value * eased);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setDisplay(value);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
      startedAtRef.current = 0;
    };
  }, [value, duration, delay]);

  return <span suppressHydrationWarning>{FORMATTERS[format](display)}</span>;
}
