"use client";

import { useState } from "react";
import { LoopRecorder } from "./LoopRecorder";

export function NewLoopForm() {
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Quote walkthrough for Acme"
          maxLength={200}
          className="w-full bg-surface/40 border border-rule rounded-md px-3 py-2 text-[13px] text-ink-strong focus:outline-none focus:border-emerald/50"
        />
      </div>
      <LoopRecorder title={title.trim() || "Untitled recording"} linkKind={null} linkedId={null} />
    </div>
  );
}
