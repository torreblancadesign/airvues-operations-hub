"use client";

// Wraps the static sprints index with a "+ New Sprint" button + modal.
// Keeps the page server-rendered (passes children) while letting us
// open a client modal for sprint creation.

import { useState } from "react";
import { NewSprintModal } from "./NewSprintModal";

type Props = {
  suggestedNumber: number;
  canEdit: boolean;
  children: React.ReactNode;
};

export function SprintsClient({ suggestedNumber, canEdit, children }: Props) {
  const [showNewModal, setShowNewModal] = useState(false);
  return (
    <>
      {canEdit && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-3 py-1.5 text-[12px] bg-emerald text-bg font-semibold rounded hover:bg-emerald/80 transition-colors inline-flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Sprint
          </button>
        </div>
      )}
      {children}
      <NewSprintModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        suggestedNumber={suggestedNumber}
      />
    </>
  );
}
