// Server Actions for the Project Log.
// `logEvent` is also exported as a plain server helper (not "use server") via
// `logEventInternal` so other mutations can call it without the action gate.
"use server";

import { revalidateTag } from "next/cache";
import { createRecords } from "../airtable";
import { Tables } from "../schema";
import { AuthzError, requireRole } from "../authz";
import type { ProjectLogEventType } from "../project-log-types";

export type LogEventArgs = {
  accountId?: string | null;
  projectId?: string | null;
  eventType: ProjectLogEventType | string;
  detail?: string;
  timestamp?: string; // ISO; defaults to now
};

// Internal helper — no auth gate; only called from inside other server actions
// that have already run requireRole. Safe because it never accepts client input
// directly without the wrapping action.
export async function logEventInternal(args: LogEventArgs): Promise<void> {
  const fields: Record<string, unknown> = {
    "Event Type": args.eventType,
    Timestamp: args.timestamp ?? new Date().toISOString(),
  };
  if (args.accountId) fields["Account"] = [args.accountId];
  if (args.projectId) fields["Project"] = [args.projectId];
  if (args.detail) fields["Detail"] = args.detail.slice(0, 50_000);
  try {
    await createRecords(Tables.ProjectLog.id, [{ fields }]);
    if (args.projectId) revalidateTag(`project-log:${args.projectId}`);
    if (args.accountId) revalidateTag(`project-log:account:${args.accountId}`);
  } catch (e) {
    // Logging must never break the wrapping mutation. Swallow + console.error.
    // eslint-disable-next-line no-console
    console.error("[project-log] failed to write event", args.eventType, (e as Error).message);
  }
}

// Public Server Action for explicit manual logging from the UI.
export async function logEvent(
  args: LogEventArgs,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireRole("admin", "lead", "editor");
  } catch (e) {
    if (e instanceof AuthzError) return { error: e.reason };
    return { error: (e as Error).message };
  }
  await logEventInternal(args);
  return { ok: true };
}
