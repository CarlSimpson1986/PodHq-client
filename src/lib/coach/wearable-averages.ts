import { londonDateString, addLondonDays } from "@/lib/london-time";

export interface WearableTrendPoint {
  date: string;
  value: number;
}

// Pure — inclusive [today - days, today] window, London-calendar-dated
// same as every other day-window calc in this app (checkin-state.ts,
// weekly-review.ts) rather than a naive UTC subtraction. Returns null
// (not 0) when nothing falls in the window, same "honest gap" convention
// as weekly-review.ts's own averages.
export function averageInWindow(points: WearableTrendPoint[], now: Date, days: number): number | null {
  const todayStr = londonDateString(now);
  const cutoffStr = londonDateString(addLondonDays(now, -days));
  const inWindow = points.filter((p) => p.date >= cutoffStr && p.date <= todayStr);
  if (inWindow.length === 0) return null;
  return inWindow.reduce((sum, p) => sum + p.value, 0) / inWindow.length;
}
