"use client";

import { Component, ReactNode } from "react";

type Props = {
  airtableUrl: string;
  onClose: () => void;
  label?: string;
  children: ReactNode;
};

type State = { error: Error | null };

// Shared error boundary used by the Quote and Story drawers so that an
// unexpected Airtable field shape degrades gracefully into a "couldn't be
// rendered" card instead of unmounting the whole sheet (or worse, the page).
export class DrawerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface the real stack so we can debug recurring shapes.
    console.error(`[${this.props.label ?? "Drawer"}] render crashed:`, error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const label = this.props.label ?? "This";
    return (
      <div className="m-5 bg-red/10 border border-red/30 rounded p-4 text-[12px] text-red space-y-3">
        <div className="font-semibold text-[13px]">{label} couldn&apos;t be rendered.</div>
        <div className="font-mono text-[11px] break-words text-red/90">
          {this.state.error.message || String(this.state.error)}
        </div>
        <div className="text-ink-muted text-[11px]">
          The error has been logged to the browser console. You can still open this record directly in Airtable.
        </div>
        <div className="flex gap-2">
          <a
            href={this.props.airtableUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
          >
            Open in Airtable ↗
          </a>
          <button
            type="button"
            onClick={this.props.onClose}
            className="px-3 py-1.5 text-[12px] bg-bg-elevated border border-rule text-ink rounded hover:border-ink-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
}
