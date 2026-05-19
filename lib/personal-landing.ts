// "Your day" — personal aggregator for the home page.
// Per signed-in user: today's calendar, your assigned stories, your action items.
import "server-only";

import { getEngineeringBoard } from "./engineering";
import { getUpcomingEvents } from "./calendar";
import { Story } from "./engineering-types";
import type { CalendarEvent } from "./calendar";

export type PersonalDay = {
  // Calendar
  todaysEvents: CalendarEvent[];
  totalEventsThisWeek: number;
  nextEvent: CalendarEvent | null;
  // Stories
  active: Story[];
  inProgress: Story[];
  qa: Story[];
  todo: Story[];
  nextToShip: Story[];
  totalOpenInvoice: number;
  totalOpenCommission: number;
  // Sprint context
  currentSprintActive: number;
  currentSprintDone: number;
  // State
  hasPerson: boolean;
};

const COMMISSION_RATE = 0.15;
const ACTIVE_STATUSES = ["Todo", "In progress", "QA Review", "Analysis Required"];

function isToday(iso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export async function getPersonalDay(personId: string | null): Promise<PersonalDay> {
  const [board, calendar] = await Promise.all([
    getEngineeringBoard(),
    getUpcomingEvents(15),
  ]);

  const events = calendar.kind === "ok" ? calendar.events : [];
  const todaysEvents = events.filter((e) => isToday(e.start));
  const nextEvent = events[0] ?? null;

  let active: Story[] = [];
  const seen = new Set<string>();

  if (personId) {
    for (const g of board.groups) {
      if (g.id !== personId) continue;
      for (const s of g.stories) {
        if (seen.has(s.id)) continue;
        if (!ACTIVE_STATUSES.includes(s.status ?? "")) continue;
        seen.add(s.id);
        active.push(s);
      }
    }
  }

  const inProgress = active.filter((s) => s.status === "In progress");
  const qa = active.filter((s) => s.status === "QA Review");
  const todo = active.filter((s) => s.status === "Todo");

  const nextToShip = [...active]
    .sort((a, b) => b.invoice - a.invoice)
    .slice(0, 3);

  let totalOpenInvoice = 0;
  for (const s of active) totalOpenInvoice += s.invoice;
  const totalOpenCommission = totalOpenInvoice * COMMISSION_RATE;

  // Current sprint context — stories assigned to user in any "In Progress" sprint
  // (Approximation: stories with at least one sprint link, status active)
  const currentSprintActive = active.filter((s) => s.sprintIds.length > 0).length;
  const currentSprintDone = personId
    ? board.groups
        .filter((g) => g.id === personId)
        .flatMap((g) => g.stories)
        .filter((s) => s.status === "Completed").length
    : 0;

  return {
    todaysEvents,
    totalEventsThisWeek: events.length,
    nextEvent,
    active,
    inProgress,
    qa,
    todo,
    nextToShip,
    totalOpenInvoice,
    totalOpenCommission,
    currentSprintActive,
    currentSprintDone,
    hasPerson: !!personId,
  };
}
