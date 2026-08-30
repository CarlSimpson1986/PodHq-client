import "server-only";
import { londonDateString } from "@/lib/london-time";
import { getTodayBookingForMember } from "@/lib/data/member";
import { getSessionStatusForBooking } from "@/lib/coach/workout-session";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets } from "@/lib/coach/nutrition-targets";
import { getDayLog } from "@/lib/coach/food-log";
import { getActiveHabits, getTodayProgress } from "@/lib/coach/daily-habits";
import { getLatestWearableSnapshot } from "@/lib/data/wearables";
import { getTodayCardioLogCount } from "@/lib/coach/cardio-equipment";

export type WorkoutMissionStatus =
  | { kind: "no_booking" }
  | { kind: "not_started"; bookingId: number }
  | { kind: "completed"; bookingId: number };

export interface TodaysMission {
  workout: WorkoutMissionStatus;
  steps: { count: number | null; target: number };
  habits: { done: number; total: number };
  nutrition: { calories: number; target: number | null };
  // Cardio equipment logging (2026-08-30) — done once at least one
  // machine's been logged today, same "count(*) > 0" posture as habits'
  // own checkbox-type done-check, not a target/count pair.
  cardio: { done: boolean };
}

// Same 8,000 figure as the "Walk 8,000+ steps" entry in habit-catalog.ts —
// kept as a plain constant here rather than a shared import since the two
// are conceptually independent (a member could delete that recommended
// habit and this card's target should stay put).
const STEP_TARGET = 8000;

// Aggregates the four Home "Today's Mission" signals from data that
// already exists elsewhere (bookings/workout_sessions, wearables, habits,
// nutrition) — this file owns none of it, it only assembles a
// same-day snapshot for the card. Every sub-fetch runs in parallel since
// none depend on each other; only the workout's session-status lookup is
// sequential (it needs the booking id first).
export async function getTodaysMission(memberId: number, gym: string, gender: string | null): Promise<TodaysMission> {
  const today = londonDateString(new Date());

  const [booking, coachProfile, dayLog, habits, progress, snapshot, cardioLogCount] = await Promise.all([
    getTodayBookingForMember(memberId, gym),
    getCoachProfile(memberId),
    getDayLog(memberId, today),
    getActiveHabits(memberId),
    getTodayProgress(memberId),
    getLatestWearableSnapshot(memberId),
    getTodayCardioLogCount(memberId, today),
  ]);

  let workout: WorkoutMissionStatus = { kind: "no_booking" };
  if (booking) {
    const sessionStatus = await getSessionStatusForBooking(booking.id);
    workout = sessionStatus === "completed" ? { kind: "completed", bookingId: booking.id } : { kind: "not_started", bookingId: booking.id };
  }

  const habitsDone = habits.filter((h) => {
    const count = progress.get(h.id) ?? 0;
    return h.habitType === "checkbox" ? count > 0 : count >= (h.targetCount ?? 1);
  }).length;

  const nutritionTarget = coachProfile ? (computeNutritionTargets(coachProfile, gender)?.calories ?? null) : null;

  return {
    workout,
    // Only counts as "today's steps" if the latest synced day is actually
    // today — a wearable that hasn't synced since yesterday shouldn't show
    // a stale count as if it were live.
    steps: { count: snapshot?.recordedDate === today ? snapshot.steps : null, target: STEP_TARGET },
    habits: { done: habitsDone, total: habits.length },
    nutrition: { calories: dayLog.totals.calories, target: nutritionTarget },
    cardio: { done: cardioLogCount > 0 },
  };
}
