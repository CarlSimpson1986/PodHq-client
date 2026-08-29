"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  GOALS,
  EXPERIENCE_LEVELS,
  FOOD_PREFERENCES,
  NUTRITION_TRACKING_MODES,
  DAILY_ACTIVITY_LEVELS,
  type Goal,
  type ExperienceLevel,
  type FoodPreference,
  type NutritionTrackingMode,
  type DailyActivityLevel,
} from "@/lib/coach/types";

const NUTRITION_MODE_LABELS: Record<NutritionTrackingMode, string> = {
  calorie_counting: "Calorie counting",
  hand_portions: "Hand portions",
};

// Same occupation-only wording as coach-onboarding-form.tsx's
// DAILY_ACTIVITY_LABELS (kept flat here, not title/subtitle, matching
// this form's plain single-line option style throughout).
const DAILY_ACTIVITY_LEVEL_LABELS: Record<DailyActivityLevel, string> = {
  sedentary: "Sedentary",
  lightly_active: "Lightly active",
  moderately_active: "Moderately active",
  very_active: "Very active",
  extra_active: "Extra active",
};

const GOAL_LABELS: Record<Goal, string> = {
  weight_loss: "Lose weight",
  muscle_gain: "Build muscle",
  fitness: "Get fitter",
  strength: "Get stronger",
};

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const FOOD_PREFERENCE_LABELS: Record<FoodPreference, string> = {
  none: "No restrictions",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  halal: "Halal",
  other: "Other",
};

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const optionClass = (selected: boolean) =>
  `rounded-lg border px-3 py-2 text-center text-sm font-medium ${
    selected
      ? "border-card-light-foreground bg-card-light-foreground text-white"
      : "border-card-light-border text-card-light-foreground hover:bg-card-border/10"
  }`;

export interface CoachProfileEditFormValues {
  goal: Goal;
  experienceLevel: ExperienceLevel;
  injuries: string;
  sessionsPerWeek: number;
  dailyActivityLevel: DailyActivityLevel | null;
  weightKg: string;
  heightCm: string;
  age: string;
  mealCountPreference: string;
  foodAllergies: string;
  foodPreferences: FoodPreference | null;
  nutritionTrackingMode: NutritionTrackingMode;
}

// A real edit flow for coach_profiles — the earlier onboarding-only path
// (coach-onboarding-form.tsx) had no way to come back and update weight,
// goal, or anything else afterwards. Same schema, same POST
// /api/member/coach-profile route (already an upsert), just a flat
// single-page form instead of onboarding's 6-step wizard since there's
// nothing to walk a returning member through — every field is already
// filled in, they're just changing one or two.
export function CoachProfileEditForm({ initial }: { initial: CoachProfileEditFormValues }) {
  const router = useRouter();
  const [form, setForm] = useState<CoachProfileEditFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof CoachProfileEditFormValues>(key: K, value: CoachProfileEditFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  const canSubmit = form.weightKg !== "" && form.heightCm !== "" && form.age !== "" && form.dailyActivityLevel !== null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/member/coach-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: form.goal,
          experienceLevel: form.experienceLevel,
          injuries: form.injuries,
          sessionsPerWeek: form.sessionsPerWeek,
          dailyActivityLevel: form.dailyActivityLevel,
          weightKg: Number(form.weightKg),
          heightCm: Number(form.heightCm),
          age: Number(form.age),
          mealCountPreference: form.mealCountPreference ? Number(form.mealCountPreference) : undefined,
          foodAllergies: form.foodAllergies,
          foodPreferences: form.foodPreferences ?? undefined,
          nutritionTrackingMode: form.nutritionTrackingMode,
        }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold">Goal</p>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((goal) => (
            <button key={goal} type="button" onClick={() => update("goal", goal)} className={optionClass(form.goal === goal)}>
              {GOAL_LABELS[goal]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Experience</p>
        <div className="grid grid-cols-3 gap-2">
          {EXPERIENCE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => update("experienceLevel", level)}
              className={optionClass(form.experienceLevel === level)}
            >
              {EXPERIENCE_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Sessions per week</p>
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} type="button" onClick={() => update("sessionsPerWeek", n)} className={optionClass(form.sessionsPerWeek === n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Daily activity (outside training)</p>
        <div className="grid grid-cols-2 gap-2">
          {DAILY_ACTIVITY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => update("dailyActivityLevel", level)}
              className={optionClass(form.dailyActivityLevel === level)}
            >
              {DAILY_ACTIVITY_LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="injuries" className="mb-2 block text-sm font-semibold">
          Injuries or limitations
        </label>
        <textarea
          id="injuries"
          rows={2}
          className={inputClass}
          value={form.injuries}
          onChange={(e) => update("injuries", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="weightKg" className="mb-1.5 block text-xs text-card-light-muted">
            Weight (kg)
          </label>
          <input id="weightKg" type="number" inputMode="decimal" className={inputClass} value={form.weightKg} onChange={(e) => update("weightKg", e.target.value)} />
        </div>
        <div>
          <label htmlFor="heightCm" className="mb-1.5 block text-xs text-card-light-muted">
            Height (cm)
          </label>
          <input id="heightCm" type="number" inputMode="decimal" className={inputClass} value={form.heightCm} onChange={(e) => update("heightCm", e.target.value)} />
        </div>
        <div>
          <label htmlFor="age" className="mb-1.5 block text-xs text-card-light-muted">
            Age
          </label>
          <input id="age" type="number" inputMode="numeric" className={inputClass} value={form.age} onChange={(e) => update("age", e.target.value)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Meals per day</p>
        <div className="grid grid-cols-5 gap-2">
          {["2", "3", "4", "5", "6"].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => update("mealCountPreference", label)}
              className={optionClass(form.mealCountPreference === label)}
            >
              {label === "6" ? "6+" : label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="foodAllergies" className="mb-2 block text-sm font-semibold">
          Food allergies
        </label>
        <textarea
          id="foodAllergies"
          rows={2}
          className={inputClass}
          value={form.foodAllergies}
          onChange={(e) => update("foodAllergies", e.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Dietary preference</p>
        <div className="grid grid-cols-2 gap-2">
          {FOOD_PREFERENCES.map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => update("foodPreferences", pref)}
              className={optionClass(form.foodPreferences === pref)}
            >
              {FOOD_PREFERENCE_LABELS[pref]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Nutrition tracking style</p>
        <div className="grid grid-cols-2 gap-2">
          {NUTRITION_TRACKING_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => update("nutritionTrackingMode", mode)}
              className={optionClass(form.nutritionTrackingMode === mode)}
            >
              {NUTRITION_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}

      <button type="submit" disabled={!canSubmit || loading} className={buttonClass}>
        {loading ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
