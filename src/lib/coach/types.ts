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

// Which pod_resources.equipment a gym's pod can have — gates exercise
// selection in generate-workout.ts. Duplicated verbatim in podHq's
// src/lib/data/types.ts, same cross-repo convention as GYM_NAMES (see
// podhq-client's src/lib/gym.ts). One "cable_machine" category
// deliberately covers both dual- and single-pulley setups — that nuance
// belongs in exercise copy, not as a separate filterable dimension
// (Carl's call, 2026-08-24).
export const EQUIPMENT_TYPES = ["barbell_rack", "cable_machine", "dumbbells", "leg_extension_curl_machine"] as const;
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

// Activity multiplier for TDEE, derived from coach_profiles.sessions_per_week
// rather than a separate onboarding question — reuses data already
// collected. Deliberately has no "sedentary" (1.2) tier: sessions_per_week
// is DB-constrained to >= 1, so nobody in this feature's population is
// sedentary by definition, and defaulting anyone to 1.2 would
// systematically underestimate calories for the whole member base.
// Standard PAL-based multiplier table (WHO activity categories), restricted
// to the 1-6 range this app actually collects.
export const ACTIVITY_MULTIPLIER_BY_SESSIONS_PER_WEEK: Record<number, number> = {
  1: 1.375,
  2: 1.375,
  3: 1.55,
  4: 1.55,
  5: 1.725,
  6: 1.725,
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
// textbook S&C, not invented; the specific rep-target numbers reuse
// REP_TARGET_BY_GOAL's existing values (10 for muscle_gain, 5 for
// strength) rather than introducing new ones. See generate-workout.ts
// and training-block-state.ts.
export const BLOCK_TYPES = ["hypertrophy", "strength", "deload"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const REP_TARGET_BY_BLOCK: Record<BlockType, number> = {
  hypertrophy: 10,
  strength: 5,
  deload: 10,
};

export const BLOCK_DURATION_WEEKS: Record<BlockType, number> = {
  hypertrophy: 12,
  strength: 12,
  deload: 1,
};

// A deload isn't just a lighter rep target — real deload programming
// reduces both intensity and volume. Directionally-correct, not a
// literature-cited number (same category as CHECK_IN_GRACE_DAYS above),
// flagged for Carl same as every other invented-but-defensible constant
// in this file.
export const DELOAD_WEIGHT_MULTIPLIER = 0.85;
export const DELOAD_SETS_PER_EXERCISE = 2;

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
