"use client";

import { useEffect, useState } from "react";

function format(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export function LiveClock() {
  const [now, setNow] = useState<string>(() => format(new Date()));

  useEffect(() => {
    const id = setInterval(() => setNow(format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-[10px] tabnum text-ink-faint tracking-wider" suppressHydrationWarning>
      {now}
    </span>
  );
}
