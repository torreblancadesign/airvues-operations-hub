"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe boolean persisted in localStorage.
 * Returns the default during the first render to avoid hydration mismatches,
 * then syncs to the stored value after mount.
 */
export function useLocalStorageBoolean(key: string, defaultValue: boolean): [boolean, (v: boolean | ((p: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(defaultValue);

  // Hydrate from storage after mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === "1" || raw === "true") setValue(true);
      else if (raw === "0" || raw === "false") setValue(false);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
