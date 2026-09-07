import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Goal, ExperienceLevel, FoodPreference, NutritionTrackingMode, DailyActivityLevel } from "@/lib/coach/types";

export interface CoachProfile {
  id: number;
  member_id: number;
  // Used as the check-in cadence anchor for a member who hasn't
  // completed one yet — see checkin-state.ts.
  created_at: string;
  goal: Goal;
  experience_level: ExperienceLevel;
  injuries: string | null;
  sessions_per_week: number;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  // Occupational activity, separate from sessions_per_week (that's for
  // programming, not this) — see types.ts's DAILY_ACTIVITY_LEVELS and
  // nutrition-targets.ts. Nullable same as weight/height/age: a profile
  // created before this column existed just has no target until the
  // member fills it in.
  daily_activity_level: DailyActivityLevel | null;
  // Collected up front alongside the fitness questions (Carl's call,
  // 2026-08-23: one onboarding pass, not a second one when nutrition
  // itself ships) — unused by generate-workout.ts, waiting for that
  // future feature.
  meal_count_preference: number | null;
  food_allergies: string | null;
  food_preferences: FoodPreference | null;
  nutrition_tracking_mode: NutritionTrackingMode;
}

// Same session-verified-first, admin-client-second pattern as every other
// data-access function in this app — see member.ts's own comment on why
// RLS's auth.uid() is never the actual authorization check.
export async function getCoachProfile(memberId: number): Promise<CoachProfile | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("coach_profiles").select("*").eq("member_id", memberId).maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export interface CoachProfileInput {
  goal: Goal;
  experienceLevel: ExperienceLevel;
  injuries: string | null;
  sessionsPerWeek: number;
  // Required on write (validated by coachProfileSchema) — Mifflin-St Jeor
  // BMR needs all three. CoachProfile's read-side type keeps these
  // nullable since the DB columns themselves stay nullable.
  weightKg: number;
  heightCm: number;
  age: number;
  dailyActivityLevel: DailyActivityLevel;
  mealCountPreference: number | null;
  foodAllergies: string | null;
  foodPreferences: FoodPreference | null;
  nutritionTrackingMode: NutritionTrackingMode;
}

// One-shot onboarding submission — no partial-save concept (unlike the
// /access flow's per-step pages), since a coach profile isn't useful to
// read until every field is answered.
export async function createCoachProfile(memberId: number, input: CoachProfileInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("coach_profiles").upsert(
    {
      member_id: memberId,
      goal: input.goal,
      experience_level: input.experienceLevel,
      injuries: input.injuries,
      sessions_per_week: input.sessionsPerWeek,
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      age: input.age,
      daily_activity_level: input.dailyActivityLevel,
      meal_count_preference: input.mealCountPreference,
      food_allergies: input.foodAllergies,
      food_preferences: input.foodPreferences,
      nutrition_tracking_mode: input.nutritionTrackingMode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );

  if (error) throw new Error(error.message);
}

// Weekly weigh-in (2026-08-30) — a plain partial update, deliberately
// NOT a call to createCoachProfile above: that function upserts every
// profile field, so reusing it from the check-in flow (which only ever
// knows about weight) would risk clobbering goal/injuries/activity
// level/etc. with stale or absent form state. Callers must already know
// a coach_profiles row exists (true for anyone who's reached the weekly
// check-in — that requires having completed onboarding first).
// nutrition-targets.ts reads weight_kg fresh on every call, so this is
// the only wiring a weigh-in needs for nutrition targets to reflect it.
export async function updateProfileWeightKg(memberId: number, weightKg: number): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("coach_profiles").update({ weight_kg: weightKg, updated_at: new Date().toISOString() }).eq("member_id", memberId);
  if (error) throw new Error(error.message);
}

export interface ExerciseHistoryEntry {
  exerciseKey: string;
  lastWeightKg: number;
  lastRpe: number | null;
  // Added 2026-09-07 for the rest-timer intelligence loop — null whenever
  // no set of the last time this exercise ran ever logged a real rest
  // (e.g. it was the very last exercise of the session, so no rest
  // followed any of its sets), same "no signal, don't guess" treatment
  // as lastRpe being null.
  lastRestActualSeconds: number | null;
  lastRestPrescribedSeconds: number | null;
}

export interface RecentSessionSummary {
  muscleGroups: string[];
}

// Self-reported once at session completion (2026-09-07, Carl: "how was
// your workout — too long, too short, just right — then it auto
// adjusts"). Plain TS union, not a DB CHECK constraint — same "burned
// twice by the SQL Editor mangling a CHECK constraint's string literal on
// paste" reasoning as credits.reason and friends.
export type DurationFeedback = "too_long" | "too_short" | "just_right";

// Pulls just enough from the last few workout_sessions to drive
// generate-workout.ts: the most recent weight/RPE per exercise (for
// progressive overload), the immediately preceding session's muscle
// groups (for rotation), and its duration feedback (for exercise-count
// adjustment). Not a full session history read — this app never needs
// more than that for generation.
export async function getWorkoutHistory(
  memberId: number,
  limit = 6
): Promise<{ history: ExerciseHistoryEntry[]; lastSession: RecentSessionSummary | null; lastDurationFeedback: DurationFeedback | null }> {
  const admin = createAdminClient();

  const { data: sessions, error: sessionsError } = await admin
    .from("workout_sessions")
    .select("id, created_at, duration_feedback")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return { history: [], lastSession: null, lastDurationFeedback: null };

  // The most recent session's own feedback, regardless of whether it (or
  // any session) has exercises to build the rest of this function's
  // return value from — a genuinely separate signal from the per-exercise
  // history below, so it's read before either early-return that follows.
  const lastDurationFeedback = (sessions[0].duration_feedback as DurationFeedback | null) ?? null;

  const sessionIds = sessions.map((s) => s.id);
  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id, session_id, exercise_key, muscle_group, rest_seconds")
    .in("session_id", sessionIds);

  if (exercisesError) throw new Error(exercisesError.message);
  if (!exercises || exercises.length === 0) return { history: [], lastSession: null, lastDurationFeedback };

  const exerciseIds = exercises.map((e) => e.id);
  const { data: sets, error: setsError } = await admin
    .from("workout_sets")
    .select("exercise_id, set_number, weight_actual_kg, rpe, rest_actual_seconds, completed_at")
    .in("exercise_id", exerciseIds)
    .not("completed_at", "is", null);

  if (setsError) throw new Error(setsError.message);

  // Most recent completed set per exercise_key. sessionOrder ranks
  // sessions[0] (newest, since sessions is ordered descending by
  // created_at) as 0 — lower rank wins. Within the SAME session, multiple
  // sets share a rank (3 sets per exercise), so set_number breaks the tie
  // toward the highest — RPE is only ever recorded on the last set of an
  // exercise (matching Zing's own "how difficult was that set" placement,
  // confirmed once per exercise not per set), so picking an earlier set
  // at the same rank would silently read lastRpe as null even though it
  // was actually recorded. Tracked in parallel maps since
  // ExerciseHistoryEntry itself doesn't carry a rank/set_number.
  const sessionOrder = new Map(sessions.map((s, i) => [s.id, i]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const latestByKey = new Map<string, ExerciseHistoryEntry>();
  const bestRankByKey = new Map<string, number>();
  const bestSetNumberByKey = new Map<string, number>();
  // Which specific workout_exercises row "won" for each key — needed
  // separately from latestByKey because rest is a per-exercise-instance
  // average across ALL its sets, not the single tie-broken set weight/RPE
  // are read from.
  const bestExerciseIdByKey = new Map<string, number>();

  for (const set of sets ?? []) {
    // A completed set with no logged weight (a duration-based hold like a
    // plank, or a set somehow completed without weight entered) has
    // nothing real to progress from — skip it entirely rather than record
    // a bogus lastWeightKg, so an older real-weight completion (if any)
    // still wins instead of being shadowed by this one.
    if (set.weight_actual_kg === null) continue;
    const exercise = exerciseById.get(set.exercise_id);
    if (!exercise) continue;
    const thisRank = sessionOrder.get(exercise.session_id) ?? Infinity;
    const bestRank = bestRankByKey.get(exercise.exercise_key) ?? Infinity;
    const bestSetNumber = bestSetNumberByKey.get(exercise.exercise_key) ?? -1;
    const isBetter = thisRank < bestRank || (thisRank === bestRank && set.set_number > bestSetNumber);
    if (isBetter) {
      bestRankByKey.set(exercise.exercise_key, thisRank);
      bestSetNumberByKey.set(exercise.exercise_key, set.set_number);
      bestExerciseIdByKey.set(exercise.exercise_key, exercise.id);
      latestByKey.set(exercise.exercise_key, {
        exerciseKey: exercise.exercise_key,
        // Progression must be based on what the member actually lifted,
        // not what was suggested (weight_target_kg) — the bug this fix
        // corrects (2026-09-06): a first-time exercise's target is null
        // by design, so reading target here silently zeroed out the very
        // next progression step for every exercise's second-ever use.
        lastWeightKg: set.weight_actual_kg,
        lastRpe: set.rpe,
        lastRestActualSeconds: null,
        lastRestPrescribedSeconds: exercise.rest_seconds,
      });
    }
  }

  // Second pass: average rest_actual_seconds across every completed set of
  // each key's winning exercise instance — a session-level average of how
  // this exercise's rest actually went, not just one set's value. Null
  // sets (no rest followed, or the member's set was completed without the
  // rest phase ever running — e.g. an old session predating this feature)
  // are excluded rather than counted as 0, so they don't drag the average
  // down to look like the member is cutting rest short when really there's
  // just no data.
  const restSumByKey = new Map<string, number>();
  const restCountByKey = new Map<string, number>();
  for (const set of sets ?? []) {
    if (set.rest_actual_seconds === null) continue;
    const exercise = exerciseById.get(set.exercise_id);
    if (!exercise) continue;
    if (bestExerciseIdByKey.get(exercise.exercise_key) !== exercise.id) continue;
    restSumByKey.set(exercise.exercise_key, (restSumByKey.get(exercise.exercise_key) ?? 0) + set.rest_actual_seconds);
    restCountByKey.set(exercise.exercise_key, (restCountByKey.get(exercise.exercise_key) ?? 0) + 1);
  }
  for (const [key, entry] of latestByKey) {
    const count = restCountByKey.get(key);
    if (!count) continue;
    entry.lastRestActualSeconds = Math.round((restSumByKey.get(key) ?? 0) / count);
  }

  const mostRecentSessionId = sessions[0].id;
  const lastSessionMuscleGroups = [
    ...new Set(exercises.filter((e) => e.session_id === mostRecentSessionId).map((e) => e.muscle_group)),
  ];

  return {
    history: [...latestByKey.values()],
    lastSession: lastSessionMuscleGroups.length > 0 ? { muscleGroups: lastSessionMuscleGroups } : null,
    lastDurationFeedback,
  };
}

export async function submitDurationFeedback(sessionId: number, feedback: DurationFeedback): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("workout_sessions").update({ duration_feedback: feedback }).eq("id", sessionId);
  if (error) throw new Error(error.message);
}
