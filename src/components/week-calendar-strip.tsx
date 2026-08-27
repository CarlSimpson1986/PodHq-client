import { londonDateParts, londonMidnight, addLondonDays } from "@/lib/london-time";

// Presentational-only week strip (Mon-Sun, today highlighted white/black)
// — no such component existed anywhere in the app before (confirmed by
// search). Purely a "here's where you are in the week" visual, matching
// the brief's Dashboard header; it doesn't drive any date selection — the
// Dashboard is always "today" per the brief's own spec.
//
// Rebuilt 2026-08-27 (Carl: "i want uniformity", comparing this against
// Book's and Nutrition's date strips) to use the exact same pill markup,
// colours, and weekday+day-number content as those two, rather than this
// component's own earlier single-letter-in-a-circle design — three
// visually different "which day is this" widgets across the app wasn't
// acceptable even though each one individually looked fine.
function currentWeekDates(): Date[] {
  const today = londonMidnight(new Date());
  const { year, month, day } = londonDateParts(today);
  // Weekday-of-a-calendar-date is timezone-independent once you have the
  // Y/M/D components, so Date.UTC(...).getUTCDay() on the London calendar
  // date is correct without a separate TZ-aware weekday lookup.
  const sundayFirstIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (sundayFirstIndex + 6) % 7;
  const monday = addLondonDays(today, -daysSinceMonday);
  return Array.from({ length: 7 }, (_, i) => addLondonDays(monday, i));
}

export function WeekCalendarStrip() {
  const dates = currentWeekDates();
  const today = londonDateParts(londonMidnight(new Date()));

  return (
    <div className="flex justify-between">
      {dates.map((d) => {
        const parts = londonDateParts(d);
        const isToday = parts.year === today.year && parts.month === today.month && parts.day === today.day;
        return (
          <div
            key={d.toISOString()}
            className={`flex flex-col items-center rounded-lg px-2 py-2 text-center ${
              isToday ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            <span className="text-xs uppercase">{d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" })}</span>
            <span className="text-base font-semibold tabular-nums">{parts.day}</span>
          </div>
        );
      })}
    </div>
  );
}
