"use client";

// Shared hook that mirrors a small filter object to URL search params so
// page state survives reloads, back/forward, and deep-link sharing.
//
// Usage:
//   const [filter, setFilter] = useSearchParamsFilter<MyFilter>({
//     defaults: EMPTY_FILTER,
//     keys: ["engineerId", "status", "client", "sprintNumber", "orphanOnly", "search"],
//   });
//
// The hook is opinionated:
// - Values equal to the default are STRIPPED from the URL.
// - Booleans serialize as "1" / absent.
// - Numbers serialize as decimal strings; "" → null.
// - Other types fall back to String(...).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type FilterShape = Record<string, string | number | boolean | null>;

export type UseSearchParamsFilterOpts<T extends FilterShape> = {
  defaults: T;
  keys: Array<keyof T>;
};

function fromParam<T extends FilterShape>(
  params: URLSearchParams,
  defaults: T,
  keys: Array<keyof T>,
): T {
  const next = { ...defaults };
  for (const k of keys) {
    const raw = params.get(String(k));
    if (raw === null) continue;
    const def = defaults[k];
    if (typeof def === "boolean") {
      (next as Record<string, unknown>)[k as string] = raw === "1" || raw === "true";
    } else if (typeof def === "number" || def === null) {
      const n = Number(raw);
      (next as Record<string, unknown>)[k as string] = Number.isFinite(n) ? n : raw;
    } else {
      (next as Record<string, unknown>)[k as string] = raw;
    }
  }
  return next;
}

function toParam<T extends FilterShape>(
  current: T,
  defaults: T,
  keys: Array<keyof T>,
): URLSearchParams {
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = current[k];
    const d = defaults[k];
    if (v === d) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "boolean") {
      if (v) out.set(String(k), "1");
    } else {
      out.set(String(k), String(v));
    }
  }
  return out;
}

export function useSearchParamsFilter<T extends FilterShape>(
  opts: UseSearchParamsFilterOpts<T>,
): [T, (next: T | ((prev: T) => T)) => void] {
  const { defaults, keys } = opts;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Snapshot keys/defaults once per mount — these are not expected to change.
  const cfgRef = useRef({ defaults, keys });

  const initial = useMemo(
    () => fromParam(new URLSearchParams(searchParams?.toString() ?? ""), cfgRef.current.defaults, cfgRef.current.keys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [filter, setFilterState] = useState<T>(initial);

  // Keep URL in sync when filter changes (replace, no scroll, no history spam).
  useEffect(() => {
    const next = toParam(filter, cfgRef.current.defaults, cfgRef.current.keys);
    const nextStr = next.toString();
    const currStr = searchParams?.toString() ?? "";
    // Preserve params we don't own.
    const preserved = new URLSearchParams(currStr);
    for (const k of cfgRef.current.keys) preserved.delete(String(k));
    for (const [k, v] of next.entries()) preserved.set(k, v);
    const merged = preserved.toString();
    if (merged === currStr) return;
    router.replace(`${pathname}${merged ? `?${merged}` : ""}`, { scroll: false });
    // We intentionally exclude searchParams from deps to avoid re-running on
    // every router update; we only want to react to local filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, pathname, router]);

  const setFilter = useCallback((next: T | ((prev: T) => T)) => {
    setFilterState((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [filter, setFilter];
}
