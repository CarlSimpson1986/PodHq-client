import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonWallTimeToUtc, addLondonDays } from "@/lib/london-time";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets, type NutritionTargets } from "@/lib/coach/nutrition-targets";

export interface WeeklyReview {
  periodStart: string;
  periodEnd: string;
  sessionsCompleted: number;
  totalVolumeKg: number;
  nutritionDaysLogged: number;
  nutritionDaysInWindow: number;
  avgDailyCalories: number | null;
  avgDailyProteinG: number | null;
  avgDailyCarbsG: number | null;
  avgDailyFatG: number | null;
  targets: NutritionTargets | null;
}

function parseDateParts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split("-").map(Number);
  return [y, m, d];
}

// Given "YYYY-MM-DD" period bounds (London calendar dates), returns the
// [inclusiveStart, exclusiveEnd) UTC instants workout_sessions.created_at
// (a timestamptz) must be compared against — a naive string/UTC comparison
// here would be exactly the class of bug london-time.ts's own header
// comment warns about (a session logged late Sunday night BST landing in
// the wrong week).
function londonWindowBounds(periodStart: string, periodEnd: string): { start: Date; end: Date } {
  const [sy, sm, sd] = parseDateParts(periodStart);
  const [ey, em, ed] = parseDateParts(periodEnd);
  const start = londonWallTimeToUtc(sy, sm, sd, 0);
  const end = addLondonDays(londonWallTimeToUtc(ey, em, ed, 0), 1);
  return { start, end };
}

// Auto-generated "let's view your week" summary for the check-in —
// follows getRecentCompletedSessions's exact two-query batching shape
// (workout_exercises by session_id, workout_sets by exercise_id) but
// date-windowed instead of limit-windowed. `gender` is passed in by the
// caller (who already has the member row from its own auth flow) rather
// than re-fetched here, matching computeNutritionTargets' own signature.
export async function getWeeklyReview(
  memberId: number,
  periodStart: string,
  periodEnd: string,
  gender: string | null
): Promise<WeeklyReview> {
  const admin = createAdminClient();
  const { start, end } = londonWindowBounds(periodStart, periodEnd);

  const [sessionsResult, foodResult, coachProfile] = await Promise.all([
    admin
      .from("workout_sessions")
      .select("id")
      .eq("member_id", memberId)
      .eq("status", "completed")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()),
    admin
      .from("food_log_entries")
      .select("logged_date, calories, protein_g, carbs_g, fat_g")
      .eq("member_id", memberId)
      .gte("logged_date", periodStart)
      .lte("logged_date", periodEnd),
    getCoachProfile(memberId),
  ]);

  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  if (foodResult.error) throw new Error(foodResult.error.message);

  const sessions = sessionsResult.data ?? [];
  let totalVolumeKg = 0;
  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id);
    const { data: exercises, error: exercisesError } = await admin
      .from("workout_exercises")
      .select("id")
      .in("session_id", sessionIds);
    if (exercisesError) throw new Error(exercisesError.message);

    const exerciseIds = (exercises ?? []).map((e) => e.id);
    if (exerciseIds.length > 0) {
      const { data: sets, error: setsError } = await admin
        .from("workout_sets")
        .select("reps_actual, weight_actual_kg")
        .in("exercise_id", exerciseIds);
      if (setsError) throw new Error(setsError.message);
      totalVolumeKg = (sets ?? []).reduce((sum, s) => sum + (s.reps_actual ?? 0) * (s.weight_actual_kg ?? 0), 0);
    }
  }

  const foodEntries = foodResult.data ?? [];
  const loggedDates = new Set(foodEntries.map((e) => e.logged_date));
  const nutritionDaysLogged = loggedDates.size;
  const nutritionDaysInWindow = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

  // Divide by days actually logged, not days in the window — averaging
  // over the full window would silently understate real intake for
  // someone who only logged some days, and read as a false "way under
  // target" signal. Return null (not 0/NaN) when nothing was logged at
  // all — the UI renders that as an honest "No meals logged this week",
  // not a fabricated zero.
  const avgDailyCalories =
    nutritionDaysLogged > 0 ? Math.round(foodEntries.reduce((sum, e) => sum + e.calories, 0) / nutritionDaysLogged) : null;
  const avgDailyProteinG =
    nutritionDaysLogged > 0 ? Math.round(foodEntries.reduce((sum, e) => sum + e.protein_g, 0) / nutritionDaysLogged) : null;
  const avgDailyCarbsG =
    nutritionDaysLogged > 0 ? Math.round(foodEntries.reduce((sum, e) => sum + e.carbs_g, 0) / nutritionDaysLogged) : null;
  const avgDailyFatG =
    nutritionDaysLogged > 0 ? Math.round(foodEntries.reduce((sum, e) => sum + e.fat_g, 0) / nutritionDaysLogged) : null;

  const targets = coachProfile ? computeNutritionTargets(coachProfile, gender) : null;

  return {
    periodStart,
    periodEnd,
    sessionsCompleted: sessions.length,
    totalVolumeKg,
    nutritionDaysLogged,
    nutritionDaysInWindow,
    avgDailyCalories,
    avgDailyProteinG,
    avgDailyCarbsG,
    avgDailyFatG,
    targets,
  };
}
