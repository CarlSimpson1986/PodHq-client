// TS-union validation for coach_profiles' text columns rather than a DB
// CHECK constraint — same convention as pod_resources.credit_type and
// waitlist_entries.status elsewhere in this shared schema (see
// 0048_coach_profiles.sql's comment).

export const GOALS = ["weight_loss", "muscle_gain", "fitness", "strength"] as const;
export type Goal = (typeof GOALS)[number];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const FOOD_PREFERENCES = ["none", "vegetarian", "vegan", "pescatarian", "halal", "other"] as const;
export type FoodPreference = (typeof FOOD_PREFERENCES)[number];

// Which view the Nutrition tab renders (2026-08-25 redesign) — detailed
// calorie/macro diary (the existing NutritionView, unchanged) vs. a
// simpler palm/cupped-hand/thumb portion count derived from the same
// food_log_entries totals. Member-toggleable in Coach settings
// (coach-profile-edit-form.tsx), defaults to calorie_counting (the
// mode that already existed before this option did).
export const NUTRITION_TRACKING_MODES = ["calorie_counting", "hand_portions"] as const;
export type NutritionTrackingMode = (typeof NUTRITION_TRACKING_MODES)[number];

// Daily habit checklist (2026-08-29, `member_habits.habit_type`) — a
// checkbox habit is done/not-done for the day (habit_logs row existence);
// a counted habit has a numeric daily target (e.g. "8 glasses of water")
// and the day's progress is however many habit_logs rows exist for it
// today. See daily-habits.ts.
export const HABIT_TYPES = ["checkbox", "counted"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

// Portion-size approximations (brief's own numbers, 2026-08-25) — a
// simple, invented-but-documented conversion from grams, same category as
// PROTEIN_TARGET_G_PER_KG above: Carl can retune these.
export const PALM_PROTEIN_G = 25;
export const CUPPED_HAND_CARBS_G = 50;
export const THUMB_FAT_G = 15;

// Which pod_resources.equipment a gym's pod can have — gates exercise
// selection in generate-workout.ts. Duplicated verbatim in podHq's
// src/lib/data/types.ts, same cross-repo convention as GYM_NAMES (see
// podhq-client's src/lib/gym.ts). One "cable_machine" category
// deliberately covers both dual- and single-pulley setups — that nuance
// belongs in exercise copy, not as a separate filterable dimension
// (Carl's call, 2026-08-24).
export const EQUIPMENT_TYPES = ["barbell_rack", "cable_machine", "dumbbells", "leg_extension_curl_machine", "kettlebells"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

// Daily protein target — flat 1.8g/kg bodyweight, Carl's call (2026-08-23):
// evidence-based consensus for exercising adults is 1.4-2.2g/kg, with the
// commonly-cited plateau for muscle-building benefit around 1.6g/kg
// (Morton et al. 2018 meta-analysis); 1.8g/kg sits a bit above that
// plateau without going to the "1g/lb" ceiling some gym culture defaults
// to — deliberately not goal-differentiated, since this member base isn't
// competitive bodybuilders and a single simple number is the point.
export const PROTEIN_TARGET_G_PER_KG = 1.8;

// 1-5, stored as workout_sets.rpe. Effortless/Easy trend the next
// suggested weight up, Just Right holds it, Hard/Killer hold or trend it
// down — see generate-workout.ts.
export const RPE_SCALE: { value: number; label: string }[] = [
  { value: 1, label: "Effortless" },
  { value: 2, label: "Easy" },
  { value: 3, label: "Just Right" },
  { value: 4, label: "Hard" },
  { value: 5, label: "Killer" },
];

// Daily calorie target hard floor — Carl's call to confirm (2026-08-23),
// same kind of explicit sign-off as PROTEIN_TARGET_G_PER_KG above: without
// this, a lighter member on an aggressive deficit (weight_loss goal, low
// TDEE) can compute below the ~1200kcal/day general safety floor most
// health bodies cite as unsafe without medical supervision. See
// nutrition-targets.ts.
export const CALORIE_TARGET_FLOOR = 1200;

// Fat target as a % of the calorie target, not a flat g/kg — ISSN/DGE
// position stands specify fat as a share of total energy intake (20-30%
// range), not a bodyweight ratio the way protein is. 0.275 is the
// midpoint of that range. See nutrition-targets.ts.
export const FAT_PERCENT_OF_TARGET = 0.275;

// Daily activity level (2026-08-29) — a member's day-to-day/occupational
// activity, entirely separate from coach_profiles.sessions_per_week
// (that field is for training-block *programming*, per Carl's own call —
// how many pod sessions a week, not how sedentary their job is). Before
// this existed, TDEE's activity multiplier was derived purely from
// sessions_per_week using the classic exercise-inclusive WHO PAL table —
// which meant an office worker and someone doing heavy manual labour who
// trained the same number of times a week got identical calorie targets.
export const DAILY_ACTIVITY_LEVELS = ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"] as const;
export type DailyActivityLevel = (typeof DAILY_ACTIVITY_LEVELS)[number];

// Standard WHO/PAL activity multiplier table, keyed on daily_activity_level
// rather than sessions_per_week. Carl's call (2026-08-29): a single ~1hr
// pod session doesn't move the needle enough on total daily burn to model
// separately, and "eating back" exercise calories is a well-known way
// people undermine a deficit — so sessions_per_week has zero influence on
// nutrition, full stop; it stays purely a programming input
// (generate-workout.ts). daily_activity_level alone drives TDEE.
export const ACTIVITY_MULTIPLIER_BY_DAILY_ACTIVITY_LEVEL: Record<DailyActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

// Which lookup found a logged food — recorded per entry so a diary row
// can always say where its numbers came from. "manual" is the MyFitnessPal-
// style "create a custom food" escape hatch, shown only when a search
// genuinely returns nothing (Carl confirmed matching MFP's own pattern,
// 2026-08-23) — not a general alternative to database search.
export const FOOD_LOG_SOURCES = ["uk_food_composition", "open_food_facts_barcode", "open_food_facts_search", "manual"] as const;
export type FoodLogSource = (typeof FOOD_LOG_SOURCES)[number];

// Weekly check-in cadence — fixed to a calendar day, not rolling from the
// last completed check-in. Carl's call (2026-08-23): "Sunday, so they can
// get motivated for Monday" — review the week just gone right before the
// work week starts, a real coaching pattern. 0 = Sunday (JS Date.getDay()
// convention). The "thundering herd" concern that would argue for a
// rolling cadence instead doesn't apply here: nothing fires in a batch
// for this feature (no push notifications, no cron job), the due state
// is just computed per-member when they open the dashboard.
export const CHECK_IN_DAY_OF_WEEK = 0;

// Grace window after the due day before the state flips from "due" to
// the more urgent "overdue" styling — a real coach doesn't treat one day
// late as urgent, only a genuinely-gone-quiet member should. See
// checkin-state.ts.
export const CHECK_IN_GRACE_DAYS = 3;

// Training-block periodization (Stage 12) — standard block periodization
// (hypertrophy/strength alternation with a deload between phases) is
// textbook S&C, not invented. See generate-workout.ts and
// training-block-state.ts.
export const BLOCK_TYPES = ["hypertrophy", "strength", "deload"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_DURATION_WEEKS: Record<BlockType, number> = {
  hypertrophy: 12,
  strength: 12,
  deload: 1,
};

// Rep-range phases within a hypertrophy/strength block (Carl's call,
// 2026-08-25) — three 4-week phases with a different rep target each,
// rather than one flat number for all 12 weeks. Deliberately NOT copying
// Schoenfeld/Oreb's 3-week-push-then-deload cadence: that model is built
// for 5-6x/week, near-max-intensity athletes whose weekly training
// stress compounds fast enough to need a deload that often. This app's
// members train 2-3x/week — far less weekly stress — so the real value
// of phasing here is stimulus variety for adherence (a fresh rep range
// every 4 weeks keeps a 12-week block from feeling stale), not fatigue
// management; the existing 1-week DELOAD block type still exists for
// that, driven off attendance/RPE trend (training-block-recommendation.ts),
// not a fixed calendar cadence. Strength's phases deliberately never go
// below 3 reps — these are unstaffed pods with no spotter, so a true
// 1-3-rep unsupervised max-effort attempt is a real injury risk this app
// won't create.
export const PHASE_DURATION_WEEKS = 4;

// hypertrophy's phase 2 deliberately isn't the midpoint of phase 1 and
// phase 3 — Carl's explicit call (2026-08-28), correcting an earlier
// average-of-the-range approach ([7, 11, 17], e.g. "10-12 reps" rounded
// to 11 — not a number anyone actually programs). Clean, round,
// deliberately-chosen targets instead, including a heavier/lower-rep
// middle phase rather than a smooth ascending curve. Weight is computed
// entirely from RPE history (computeWeightKg/adjustForRpe), never from
// repsTarget, so this phase shape has no hidden interaction with load.
export const REP_TARGET_BY_BLOCK_PHASE: Record<"hypertrophy" | "strength", [number, number, number]> = {
  hypertrophy: [12, 6, 15], // weeks 1-4, 5-8, 9-12
  strength: [6, 4, 3], // weeks 1-4, 5-8, 9-12 — floor of 3, never a max-effort single/double
};

export const DELOAD_REP_TARGET = 10;

// A deload isn't just a lighter rep target — real deload programming
// reduces both intensity and volume. Directionally-correct, not a
// literature-cited number (same category as CHECK_IN_GRACE_DAYS above),
// flagged for Carl same as every other invented-but-defensible constant
// in this file.
export const DELOAD_WEIGHT_MULTIPLIER = 0.85;
export const DELOAD_SETS_PER_EXERCISE = 2;

// Exercise-count budget (2026-08-29, Carl's call) — replaces a flat
// "always 4 exercises" with "however many actually fit in a 50-minute
// session", computed from rep target (drives set duration) and rest time
// (compound vs. isolation, hypertrophy vs. strength). All four numbers
// here are invented-but-defensible, same category as this file's other
// non-literature-cited constants — flagged for Carl to tune:
// - SECONDS_PER_REP: ~3s per rep (concentric + eccentric), a common
//   general estimate, not exercise-specific.
// - SESSION_SECONDS: the 50-minute pod slot, used in full (warm-up/
//   cool-down are separate member-toggled steps in workout-view.tsx, not
//   part of this budget).
// - REST_SECONDS_BY_BLOCK: hypertrophy is Carl's own numbers (2min
//   compound/multi-joint, 90s isolation/single-joint); strength is longer
//   for heavier, lower-rep work (standard strength-training convention);
//   deload reuses hypertrophy's numbers — lighter load, not necessarily
//   shorter rest, revisit if that's wrong.
export const SECONDS_PER_REP = 3;
export const SESSION_SECONDS = 50 * 60;
export const REST_SECONDS_BY_BLOCK: Record<BlockType, { compound: number; isolation: number }> = {
  hypertrophy: { compound: 120, isolation: 90 },
  strength: { compound: 180, isolation: 120 },
  deload: { compound: 120, isolation: 90 },
};

// Suggestion-gating thresholds for "is it time to shift blocks" —
// deliberately invented heuristics, not literature-cited (same category
// as CHECK_IN_GRACE_DAYS), acceptable specifically because they only
// ever produce a suggestion a member must explicitly confirm, never an
// autonomous change. See block-change-gate.ts.
// A real coach wouldn't advance someone who missed roughly half their
// planned sessions — they haven't earned the next phase's stimulus.
export const BLOCK_ATTENDANCE_KEEP_THRESHOLD = 0.6;
// More sets hard-or-killer than not, the natural majority line — only
// checked at the one real escalation point in the cycle (deload→strength).
export const BLOCK_HIGH_RPE_THRESHOLD = 0.5;
// Below this many logged RPE values, the sample is too thin to trust —
// gate on attendance alone rather than let a sparse sample swing the
// recommendation either way.
export const BLOCK_MIN_RPE_SAMPLE = 3;

// Recovery signal (Health Centre) — same category as the block-change
// thresholds above: deliberately invented, defensible heuristics for a
// member-confirmed suggestion, not literature-cited numbers and never
// gating an autonomous change (see recovery-signal.ts and
// applyRecoveryAdjustment in workout-session.ts, which only ever fires
// on explicit member confirmation).
// Below this many trailing days of synced wearable data, there's no
// reliable personal baseline to compare today against.
export const RECOVERY_MIN_BASELINE_DAYS = 5;
// +5bpm over the trailing baseline average — a real, not noise-level,
// elevation for resting heart rate.
export const RECOVERY_RESTING_HR_DELTA = 5;
// -60min under the trailing baseline average sleep.
export const RECOVERY_SLEEP_MINUTES_DELTA = 60;
