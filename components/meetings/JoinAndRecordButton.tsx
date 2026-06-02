"use client";

// Replaces the bare "Join meeting" link on a Lead. Opens the meeting URL in a
// new tab AND opens the recorder popup pre-bound to this lead.
import { useCallback } from "react";

type Props = {
  meetingUrl: string;
  leadId?: string | null;
  source?: "meet" | "zoom" | "other";
  label?: string;
  className?: string;
  isJoinable?: boolean;
};

export function JoinAndRecordButton({
  meetingUrl,
  leadId,
  source,
  label,
  className,
  isJoinable,
}: Props) {
  const inferSource = (): "meet" | "zoom" | "other" => {
    if (source) return source;
    try {
      const host = new URL(meetingUrl).hostname;
      if (host.includes("meet.google.com")) return "meet";
      if (host.includes("zoom.")) return "zoom";
    } catch {
      /* ignore */
    }
    return "other";
  };

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const detectedSource = inferSource();
      // 1) Open the actual meeting in a new tab.
      window.open(meetingUrl, "_blank", "noopener");
      // 2) Open recorder popup, pre-bound to this lead.
      const params = new URLSearchParams();
      if (leadId) params.set("leadId", leadId);
      params.set("source", detectedSource);
      const url = `/recorder?${params.toString()}`;
      const popup = window.open(
        url,
        "airvues-recorder",
        "width=440,height=620,popup=yes,noopener=no",
      );
      if (!popup) {
        // Popup blocked — fall back to a same-tab open in a small chunk.
        alert(
          "Popup was blocked. Allow popups for this site so the recorder can open alongside the meeting.",
        );
      } else {
        try {
          popup.focus();
        } catch {
          /* ignore */
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetingUrl, leadId, source],
  );

  return (
    <a
      href={meetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={
        className ??
        `px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${
          isJoinable
            ? "bg-emerald text-bg hover:bg-emerald/80"
            : "bg-bg-elevated border border-rule text-ink hover:border-ink-muted"
        }`
      }
    >
      {label ?? (isJoinable ? "Join + record ↗" : "Join + record ↗")}
    </a>
  );
}
