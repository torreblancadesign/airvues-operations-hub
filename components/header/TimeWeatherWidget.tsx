"use client";

import { useEffect, useRef, useState } from "react";
import type { WeatherSnapshot } from "@/lib/weather";

type Props = {
  weather: WeatherSnapshot;
};

type ZoneRow = {
  label: string;
  ianaZone: string;
};

// Default panel zones — Airvues is California-based, team spread across the Americas.
const ZONES: ZoneRow[] = [
  { label: "Los Angeles", ianaZone: "America/Los_Angeles" },
  { label: "New York", ianaZone: "America/New_York" },
  { label: "Mexico City", ianaZone: "America/Mexico_City" },
  { label: "Caracas", ianaZone: "America/Caracas" },
  { label: "London", ianaZone: "Europe/London" },
];

function formatTimeHM(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zone,
  }).format(date);
}

function formatDateLine(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(date);
}

function detectLocalZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function TimeWeatherWidget({ weather }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [open, setOpen] = useState(false);
  const [localZone, setLocalZone] = useState<string>("UTC");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalZone(detectLocalZone());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close panel on outside click + Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const localTime = formatTimeHM(now, localZone);
  const tempChip = weather.temperatureF != null ? `${weather.temperatureF}°` : "—";

  // Build the zone list — local first, then the standard set with local de-duped.
  const zoneList: ZoneRow[] = [
    { label: "Local", ianaZone: localZone },
    ...ZONES.filter((z) => z.ianaZone !== localZone),
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="World clocks and weather"
        className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-rule bg-surface hover:border-emerald/40 hover:bg-bg-elevated transition-all text-[12px]"
      >
        <span className="font-mono tabnum text-ink-strong" suppressHydrationWarning>
          {localTime}
        </span>
        <span className="w-px h-4 bg-rule" aria-hidden="true" />
        <span className="text-ink-muted leading-none" aria-hidden="true">
          {weather.conditionEmoji ?? "·"}
        </span>
        <span className="font-mono tabnum text-ink-strong">{tempChip}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[300px] bg-surface border border-rule rounded-card shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200"
          role="dialog"
        >
          {/* Header — local big time */}
          <div className="px-4 py-3 border-b border-rule bg-bg-elevated">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-faint">
                Your local time
              </div>
              <div className="text-[10px] font-mono text-ink-faint tabnum">
                {formatDateLine(now, localZone)}
              </div>
            </div>
            <div className="mt-1 text-[28px] font-semibold text-ink-strong tabnum leading-none" suppressHydrationWarning>
              {new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZone: localZone,
              }).format(now)}
            </div>
            <div className="mt-1 text-[10px] font-mono text-ink-faint">{localZone}</div>
          </div>

          {/* Zones */}
          <ul className="px-2 py-2">
            {zoneList.slice(1).map((z) => (
              <li
                key={z.ianaZone}
                className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md hover:bg-bg-elevated transition-colors"
              >
                <span className="text-[12px] text-ink-muted">{z.label}</span>
                <span
                  className="font-mono tabnum text-[13px] text-ink-strong"
                  suppressHydrationWarning
                >
                  {formatTimeHM(now, z.ianaZone)}
                </span>
              </li>
            ))}
          </ul>

          {/* Weather */}
          <div className="px-4 py-3 border-t border-rule bg-bg-elevated">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-faint">
                  Weather
                </div>
                <div className="mt-1 text-[13px] text-ink-strong">
                  {weather.city
                    ? `${weather.city}${weather.region ? `, ${weather.region}` : ""}`
                    : "Location unavailable"}
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  {weather.conditionLabel ?? "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[28px] font-semibold text-ink-strong tabnum leading-none">
                  {weather.temperatureF != null ? `${weather.temperatureF}°` : "—"}
                </div>
                {weather.conditionEmoji && (
                  <div className="text-[24px] mt-1" aria-hidden="true">
                    {weather.conditionEmoji}
                  </div>
                )}
              </div>
            </div>
            {weather.isFallback && (
              <div className="mt-2 text-[10px] font-mono text-ink-faint">
                Using fallback location (dev / no geo headers).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
