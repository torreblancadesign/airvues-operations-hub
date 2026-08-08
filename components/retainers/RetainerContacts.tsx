"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addRetainerContact,
  removeRetainerContact,
  setContactPortalAccess,
  setContactPortalRole,
} from "@/lib/mutations/retainer-contact";
import { readinessOf, sortContacts } from "@/lib/retainer-contact-rules";
import type { PortalRole, RetainerContact } from "@/lib/retainer-types";

const input =
  "px-2 py-1 text-[12px] bg-bg-elevated border border-rule text-ink rounded focus:border-emerald focus:outline-none";

const STATUS: Record<
  ReturnType<typeof readinessOf>,
  { label: string; tone: string; dot: string }
> = {
  active: { label: "signed in", tone: "text-emerald", dot: "bg-emerald" },
  invited: { label: "access granted", tone: "text-sky", dot: "bg-sky" },
  "no-access": { label: "no portal access", tone: "text-ink-faint", dot: "bg-rule-strong" },
  "no-email": { label: "no email — cannot sign in", tone: "text-amber", dot: "bg-amber" },
};

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

export function RetainerContacts({
  contacts,
  companyId,
  companyName,
  canEdit,
}: {
  contacts: RetainerContact[];
  companyId: string | null;
  companyName: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const locked = busy || pending;

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PortalRole>("Member");
  const [grant, setGrant] = useState(true);

  const rows = sortContacts(contacts);

  function done(msg: string) {
    setError(null);
    setMessage(msg);
    setAdding(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("Member");
    setGrant(true);
    startTransition(() => router.refresh());
  }

  async function run<T>(fn: () => Promise<T | { error: string }>, ok: (r: T) => string) {
    if (locked) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = (await fn()) as T & { error?: string };
      if (res && typeof res === "object" && "error" in res && res.error) {
        setError(res.error as string);
        return;
      }
      done(ok(res));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-surface border border-rule rounded-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
        <div>
          <div className="eyebrow">Client contacts</div>
          <div className="text-[11px] text-ink-faint mt-0.5">
            {rows.length === 0
              ? "Nobody linked yet"
              : `${rows.length} at ${companyName ?? "this client"}`}
          </div>
        </div>
        {canEdit && companyId && !adding && (
          <button
            onClick={() => {
              setAdding(true);
              setError(null);
              setMessage(null);
            }}
            className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted hover:text-emerald hover:border-emerald transition-colors"
          >
            Add contact
          </button>
        )}
      </div>

      {error && <div className="px-4 py-2.5 text-[12px] text-red border-b border-rule">{error}</div>}
      {message && (
        <div className="px-4 py-2.5 text-[12px] text-emerald border-b border-rule">{message}</div>
      )}

      {adding && companyId && (
        <div className="px-4 py-3 border-b border-rule bg-bg-elevated space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-[11px] text-ink-muted block mb-1">First name</span>
              <input
                className={`${input} w-full`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted block mb-1">Last name</span>
              <input
                className={`${input} w-full`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label className="block lg:col-span-2">
              <span className="text-[11px] text-ink-muted block mb-1">Email</span>
              <input
                type="email"
                className={`${input} w-full`}
                placeholder="they sign in with this"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-[12px] text-ink-muted flex items-center gap-2">
              Role
              <select
                className={input}
                value={role}
                onChange={(e) => setRole(e.target.value as PortalRole)}
              >
                <option value="Member">Member — view and submit</option>
                <option value="Owner">Owner — can also invite colleagues</option>
              </select>
            </label>
            <label className="text-[12px] text-ink-muted flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-emerald"
                checked={grant}
                onChange={(e) => setGrant(e.target.checked)}
              />
              Grant portal access now
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                run(
                  () =>
                    addRetainerContact({
                      companyId,
                      firstName,
                      lastName,
                      email,
                      portalRole: role,
                      grantAccess: grant,
                    }),
                  (r) =>
                    (r as { linked: boolean }).linked
                      ? "That email already existed in People — the existing record was linked to this client instead of creating a duplicate."
                      : "Contact added.",
                )
              }
              disabled={locked}
              className="px-3 py-1.5 text-[12px] rounded bg-emerald text-black font-medium disabled:opacity-50"
            >
              {locked ? "Saving…" : "Add contact"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-[12px] rounded border border-rule text-ink-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <div className="text-[13px] text-ink-muted">No client contacts yet</div>
          <div className="text-[11px] text-ink-faint mt-1 max-w-sm mx-auto leading-snug">
            {companyId
              ? "Add the people at this client who should be able to see the retainer and file requests."
              : "This retainer has no client linked, so contacts cannot be scoped to one."}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-rule/60">
          {rows.map((c) => {
            const state = STATUS[readinessOf(c)];
            return (
              <li key={c.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${state.dot}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] text-ink-strong">{c.name}</div>
                    <div className="text-[11px] text-ink-muted truncate">
                      {c.email ?? "no email on record"}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${state.tone}`}>
                      {c.portalRole ?? "no role"} · {state.label}
                      {c.portalLastLogin && ` · last seen ${shortDate(c.portalLastLogin)}`}
                      {!c.portalLastLogin &&
                        c.portalInvitedAt &&
                        ` · granted ${shortDate(c.portalInvitedAt)}`}
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={c.portalRole ?? "Member"}
                      onChange={(e) =>
                        run(
                          () => setContactPortalRole(c.id, e.target.value as PortalRole),
                          () => `${c.name} is now ${e.target.value}.`,
                        )
                      }
                      disabled={locked}
                      className="px-2 py-1 text-[11px] bg-bg-elevated border border-rule text-ink rounded focus:border-emerald focus:outline-none disabled:opacity-50"
                    >
                      <option value="Member">Member</option>
                      <option value="Owner">Owner</option>
                    </select>
                    <button
                      onClick={() =>
                        run(
                          () =>
                            setContactPortalAccess(c.id, !c.portalAccess, {
                              alreadyInvited: c.portalInvitedAt !== null,
                            }),
                          () =>
                            c.portalAccess
                              ? `Portal access revoked for ${c.name}.`
                              : `Portal access granted to ${c.name}. No email was sent.`,
                        )
                      }
                      disabled={locked || !c.email}
                      title={c.email ? undefined : "Needs an email address first"}
                      className="text-[11px] text-ink-muted hover:text-emerald disabled:opacity-40 disabled:hover:text-ink-muted"
                    >
                      {c.portalAccess ? "Revoke" : "Grant access"}
                    </button>
                    <button
                      onClick={() =>
                        run(
                          () => removeRetainerContact(c.id),
                          () => `${c.name} detached from this client.`,
                        )
                      }
                      disabled={locked}
                      title="Unlinks them from this client. The person record is kept."
                      className="text-[11px] text-ink-faint hover:text-amber disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-4 py-2.5 border-t border-rule text-[11px] text-ink-faint leading-snug">
        Granting access records who is allowed in. It does not email anyone — the portal and its
        magic-link sign-in are not built yet.
      </div>
    </section>
  );
}
