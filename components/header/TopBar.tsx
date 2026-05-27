import { getWeatherSnapshot } from "@/lib/weather";
import { getUpcomingEvents, type CalendarResult } from "@/lib/calendar";
import { getRecentInbox, type InboxResult } from "@/lib/gmail";
import { TimeWeatherWidget } from "./TimeWeatherWidget";
import { CalendarWidget } from "./CalendarWidget";
import { GmailWidget } from "./GmailWidget";
import { SearchTrigger } from "@/components/search/SearchTrigger";

export async function TopBar() {
  const [weather, calendar, inbox] = await Promise.all([
    getWeatherSnapshot().catch(() => ({
      city: null,
      region: null,
      country: null,
      timezone: null,
      temperatureF: null,
      conditionLabel: null,
      conditionEmoji: null,
      isFallback: true,
    })),
    getUpcomingEvents().catch(
      (err): CalendarResult => ({ kind: "error", message: (err as Error).message }),
    ),
    getRecentInbox().catch(
      (err): InboxResult => ({ kind: "error", message: (err as Error).message }),
    ),
  ]);

  return (
    <div className="hidden md:flex items-center justify-between gap-2 h-12 px-4 sm:px-6 border-b border-rule-soft bg-bg/50 backdrop-blur sticky top-0 z-30">
      <SearchTrigger />
      <div className="flex items-center gap-2">
        <GmailWidget result={inbox} />
        <CalendarWidget result={calendar} />
        <TimeWeatherWidget weather={weather} />
      </div>
    </div>
  );
}
