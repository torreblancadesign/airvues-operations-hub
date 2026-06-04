"use client";

// Tiny client wrapper around JoinAndRecordButton-style behavior for the
// /meetings page header. Lets users start a manual recording (no lead).
import { useCallback } from "react";

export function NewRecordingButton({ className }: { className?: string }) {
  const onClick = useCallback(() => {
    const popup = window.open(
      "/recorder?source=manual",
      "airvues-recorder",
      "width=440,height=620,popup=yes,noopener=no",
    );
    if (!popup) {
      alert(
        "Pop-up was blocked. Please allow pop-ups for this site in Chrome (click the pop-up icon in the address bar → Always allow) so the recorder can open.",
      );
    } else {
      try {
        popup.focus();
      } catch {
        /* ignore */
      }
    }
  }, []);
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ??
        "inline-block px-4 py-2 rounded-md bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/20 text-[13px] font-medium transition"
      }
    >
      ● New recording
    </button>
  );
}
