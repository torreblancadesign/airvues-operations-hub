// Gmail reader. Uses the user's OAuth access token (NextAuth session) to fetch
// recent unread inbox messages. Read-only.
import "server-only";

import { auth } from "./auth";

export type InboxMessage = {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  internalDate: number;
  ageLabel: string;
  link: string;
  unread: boolean;
};

export type InboxResult =
  | { kind: "ok"; messages: InboxMessage[]; unreadCount: number }
  | { kind: "no-token" }
  | { kind: "error"; message: string };

type GmailListItem = { id: string; threadId: string };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
  };
};

function header(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return "";
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

// "Lee Tsao <lee@airvues.com>" → { name: "Lee Tsao", email: "lee@airvues.com" }
function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) {
    return { name: m[1].trim() || m[2], email: m[2] };
  }
  return { name: raw.trim(), email: raw.trim() };
}

function ageLabel(internalDateMs: number): string {
  const now = Date.now();
  const diff = now - internalDateMs;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  return `${weeks}w`;
}

export async function getRecentInbox(maxResults = 8): Promise<InboxResult> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) return { kind: "no-token" };

  try {
    // 1) Fetch list of unread message IDs from INBOX
    const listResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
        labelIds: "INBOX",
        q: "is:unread",
        maxResults: String(maxResults),
      })}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 60 },
      },
    );
    if (listResp.status === 401 || listResp.status === 403) return { kind: "no-token" };
    if (!listResp.ok) return { kind: "error", message: `Gmail list ${listResp.status}` };

    const listData = await listResp.json();
    const items: GmailListItem[] = listData.messages ?? [];
    const unreadCount = listData.resultSizeEstimate ?? items.length;

    if (items.length === 0) {
      return { kind: "ok", messages: [], unreadCount: 0 };
    }

    // 2) Fetch each message's metadata in parallel
    const msgs = await Promise.all(
      items.map(async (it) => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${it.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${token}` },
            next: { revalidate: 60 },
          },
        );
        if (!r.ok) return null;
        return (await r.json()) as GmailMessage;
      }),
    );

    const messages: InboxMessage[] = msgs
      .filter((m): m is GmailMessage => !!m)
      .map((m) => {
        const fromRaw = header(m.payload?.headers, "From");
        const { name, email } = parseFrom(fromRaw);
        const subject = header(m.payload?.headers, "Subject") || "(no subject)";
        const internal = Number(m.internalDate ?? "0");
        return {
          id: m.id,
          threadId: m.threadId,
          from: fromRaw,
          fromName: name,
          fromEmail: email,
          subject,
          snippet: (m.snippet ?? "").replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          internalDate: internal,
          ageLabel: ageLabel(internal),
          link: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
          unread: m.labelIds?.includes("UNREAD") ?? true,
        };
      })
      .sort((a, b) => b.internalDate - a.internalDate);

    return { kind: "ok", messages, unreadCount };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}
