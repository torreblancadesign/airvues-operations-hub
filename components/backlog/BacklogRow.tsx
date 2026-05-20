"use client";

import { Story } from "@/lib/engineering-types";

type Props = {
  story: Story;
  selected: boolean;
  active: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onOpen: (s: Story) => void;
};


function statusPill(status: string | null): { text: string; cls: string } {
  switch (status) {
    case "In progress": return { text: "In progress", cls: "bg-emerald/15 text-emerald border-emerald/30" };
    case "Todo": return { text: "Todo", cls: "bg-bg-elevated text-ink-muted border-rule" };
    case "QA Review": return { text: "QA", cls: "bg-sky/15 text-sky border-sky/30" };
    case "Completed": return { text: "Done", cls: "bg-violet/15 text-violet border-violet/30" };
    case "On Hold": return { text: "On hold", cls: "bg-amber/15 text-amber border-amber/30" };
    case "Incomplete": return { text: "Incomplete", cls: "bg-red/15 text-red border-red/30" };
    case "Analysis Required": return { text: "Analysis", cls: "bg-amber/15 text-amber border-amber/30" };
    default: return { text: "—", cls: "bg-bg-elevated text-ink-faint border-rule" };
  }
}

function priorityDot(p: string | null): string {
  switch (p) {
    case "Urgent": return "bg-red";
    case "High": return "bg-amber";
    case "Medium": return "bg-sky";
    case "Low": return "bg-ink-faint";
    default: return "bg-bg-elevated";
  }
}

export function BacklogRow({ story, selected, active, onSelect, onOpen }: Props) {
  const status = statusPill(story.status);
  const orphan = story.assigneeIds.length === 0;
  const sprintNum = story.sprintNumbers[0];

  return (
    <tr
      className={`group border-b border-rule cursor-pointer transition-colors ${
        active
          ? "bg-emerald/5"
          : selected
            ? "bg-bg-elevated"
            : "hover:bg-bg-elevated/60"
      }`}
      onClick={() => onOpen(story)}
    >
      <td
        className="px-3 py-2 w-8"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(story.id, (e.nativeEvent as MouseEvent).shiftKey)}
          className="accent-emerald w-3.5 h-3.5"
          aria-label={`Select story ${story.storyNumber}`}
        />
      </td>
      <td className="px-2 py-2 text-[11px] font-mono text-ink-faint tabnum">
        {story.storyNumber ?? "—"}
      </td>
      <td className="px-2 py-2 max-w-0 w-full">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot(story.priority)}`}
            aria-label={story.priority ?? "no priority"}
          />
          <span className="text-[13px] text-ink-strong truncate group-hover:text-emerald transition-colors">
            {story.name}
          </span>
        </div>
      </td>
      <td className="px-2 py-2 hidden md:table-cell whitespace-nowrap">
        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${status.cls}`}>
          {status.text}
        </span>
      </td>
      <td className="px-2 py-2 hidden lg:table-cell text-[12px] text-ink-muted whitespace-nowrap max-w-[160px] truncate">
        {orphan ? (
          <span className="text-red">Unassigned</span>
        ) : (
          story.assigneeNames.join(", ")
        )}
      </td>
      <td className="px-2 py-2 hidden md:table-cell text-[12px] text-ink-muted whitespace-nowrap max-w-[140px] truncate">
        {story.clientNames[0] ?? "—"}
      </td>
      <td className="px-2 py-2 hidden lg:table-cell text-[12px] text-ink-muted whitespace-nowrap max-w-[180px] truncate">
        {story.quoteLabels[0] ?? "—"}
      </td>
      <td className="px-2 py-2 text-right text-[12px] tabnum text-ink-strong font-semibold whitespace-nowrap">
        {story.hours ?? "—"}
      </td>
      <td className="px-2 py-2 hidden lg:table-cell text-[11px] font-mono text-ink-faint tabnum">
        {sprintNum != null ? `#${sprintNum}` : "—"}
      </td>
    </tr>
  );
}
