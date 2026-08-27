import { londonDateParts } from "@/lib/london-time";

// Presentational-only week strip (7 circles, Mon-Sun, today filled white/
// black) — no such component existed anywhere in the app before (confirmed
// by search). Purely a "here's where you are in the week" visual, matching
// the brief's Dashboard header; it doesn't drive any date selection —
// the Dashboard is always "today" per the brief's own spec. Today's
// highlight was gold until 2026-08-27, when it was switched to match
// Book's own date-strip (bg-foreground/text-background) — Carl wanted one
// consistent highlight language for "this is the relevant day" rather than
// two different ones (gold circle here, white square there).
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function WeekCalendarStrip() {
  // Weekday-of-a-calendar-date is timezone-independent once you have the
  // Y/M/D components, so Date.UTC(...).getUTCDay() on the London calendar
  // date is correct without a separate TZ-aware weekday lookup. Rotated
  // from Sunday-first (JS default) to Monday-first to match DAY_LABELS.
  const { year, month, day } = londonDateParts(new Date());
  const sundayFirstIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const todayIndex = (sundayFirstIndex + 6) % 7;

  return (
    <div className="flex justify-between">
      {DAY_LABELS.map((label, i) => {
        const isToday = i === todayIndex;
        return (
          <div
            key={i}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
              isToday ? "bg-foreground text-background" : "border border-card-border text-muted-foreground"
            }`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
