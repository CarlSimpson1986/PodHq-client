"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  GOALS,
  EXPERIENCE_LEVELS,
  FOOD_PREFERENCES,
  DAILY_ACTIVITY_LEVELS,
  type Goal,
  type ExperienceLevel,
  type FoodPreference,
  type DailyActivityLevel,
} from "@/lib/coach/types";

const GOAL_LABELS: Record<Goal, string> = {
  weight_loss: "Lose weight",
  muscle_gain: "Build muscle",
  fitness: "Get fitter",
  strength: "Get stronger",
};

const EXPERIENCE_LABELS: Record<ExperienceLevel, { title: string; subtitle: string }> = {
  beginner: { title: "Beginner", subtitle: "I'm new to fitness" },
  intermediate: { title: "Intermediate", subtitle: "I work out from time to time" },
  advanced: { title: "Advanced", subtitle: "I exercise regularly" },
};

const FOOD_PREFERENCE_LABELS: Record<FoodPreference, string> = {
  none: "No restrictions",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  halal: "Halal",
  other: "Other",
};

// Deliberately worded around occupation/daily life only, with no mention
// of exercise — structured pod training is a separate question
// (sessionsPerWeek, step 4) and gets its own additive calorie estimate
// (nutrition-targets.ts's RESISTANCE_TRAINING_MET), so blending exercise
// language in here would risk a member double-counting it themselves.
const DAILY_ACTIVITY_LABELS: Record<DailyActivityLevel, { title: string; subtitle: string }> = {
  sedentary: { title: "Sedentary", subtitle: "Desk job, mostly sitting" },
  lightly_active: { title: "Lightly active", subtitle: "On your feet sometimes, e.g. retail or teaching" },
  moderately_active: { title: "Moderately active", subtitle: "On your feet most of the day" },
  very_active: { title: "Very active", subtitle: "Physically demanding job, e.g. trade or warehouse work" },
  extra_active: { title: "Extra active", subtitle: "Heavy manual labour, e.g. construction" },
};

const TOTAL_STEPS = 7;

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const optionClass = (selected: boolean) =>
  `w-full rounded-lg border px-4 py-3 text-left text-sm font-medium ${
    selected
      ? "border-card-light-foreground bg-card-light-foreground text-white"
      : "border-card-light-border text-card-light-foreground hover:bg-card-border/10"
  }`;

interface FormState {
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  injuries: string;
  sessionsPerWeek: number | null;
  dailyActivityLevel: DailyActivityLevel | null;
  weightKg: string;
  heightCm: string;
  age: string;
  mealCountPreference: string;
  foodAllergies: string;
  foodPreferences: FoodPreference | null;
  agreedToPrivacy: boolean;
}

const INITIAL_STATE: FormState = {
  goal: null,
  experienceLevel: null,
  injuries: "",
  sessionsPerWeek: null,
  dailyActivityLevel: null,
  weightKg: "",
  heightCm: "",
  age: "",
  mealCountPreference: "",
  foodAllergies: "",
  foodPreferences: null,
  agreedToPrivacy: false,
};

export function CoachOnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canAdvance =
    (step === 1 && form.goal !== null) ||
    (step === 2 && form.experienceLevel !== null) ||
    step === 3 ||
    (step === 4 && form.sessionsPerWeek !== null) ||
    (step === 5 && form.dailyActivityLevel !== null) ||
    (step === 6 && form.weightKg !== "" && form.heightCm !== "" && form.age !== "") ||
    step === 7;

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
          agreedToPrivacy: form.agreedToPrivacy,
        }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-card-light-border"}`} />
        ))}
      </div>

      {step === 1 && (
        <fieldset className="space-y-5">
          <legend className="mb-1.5 block text-base font-semibold">What&apos;s your main goal?</legend>
          <div className="space-y-2">
            {GOALS.map((goal) => (
              <button key={goal} type="button" onClick={() => update("goal", goal)} className={optionClass(form.goal === goal)}>
                {GOAL_LABELS[goal]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 2 && (
        <fieldset className="space-y-5">
          <legend className="mb-1.5 block text-base font-semibold">What&apos;s your current fitness level?</legend>
          <div className="space-y-2">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => update("experienceLevel", level)}
                className={optionClass(form.experienceLevel === level)}
              >
                <span className="block font-semibold">{EXPERIENCE_LABELS[level].title}</span>
                <span className="block text-xs opacity-80">{EXPERIENCE_LABELS[level].subtitle}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <label htmlFor="injuries" className="mb-1.5 block text-base font-semibold">
            Any injuries or limitations?
          </label>
          <textarea
            id="injuries"
            rows={3}
            placeholder="Nothing to work around"
            className={inputClass}
            value={form.injuries}
            onChange={(e) => update("injuries", e.target.value)}
          />
          <p className="text-xs text-card-light-muted">Leave blank if nothing to note.</p>
        </div>
      )}

      {step === 4 && (
        <fieldset className="space-y-5">
          <legend className="mb-1.5 block text-base font-semibold">How many sessions per week?</legend>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" onClick={() => update("sessionsPerWeek", n)} className={optionClass(form.sessionsPerWeek === n)}>
                <span className="block text-center">{n}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 5 && (
        <fieldset className="space-y-5">
          <legend className="mb-1.5 block text-base font-semibold">What&apos;s your day-to-day like?</legend>
          <p className="-mt-3 text-xs text-card-light-muted">Outside your pod sessions — your job and general daily activity.</p>
          <div className="space-y-2">
            {DAILY_ACTIVITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => update("dailyActivityLevel", level)}
                className={optionClass(form.dailyActivityLevel === level)}
              >
                <span className="block font-semibold">{DAILY_ACTIVITY_LABELS[level].title}</span>
                <span className="block text-xs opacity-80">{DAILY_ACTIVITY_LABELS[level].subtitle}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 6 && (
        <div className="space-y-5">
          <p className="text-base font-semibold">Your body stats</p>
          <p className="-mt-3 text-xs text-card-light-muted">
            Needed to work out your daily energy needs once nutrition guidance is available.
          </p>
          <div>
            <label htmlFor="weightKg" className="mb-1.5 block text-sm text-card-light-muted">
              Weight (kg)
            </label>
            <input id="weightKg" type="number" inputMode="decimal" className={inputClass} value={form.weightKg} onChange={(e) => update("weightKg", e.target.value)} />
          </div>
          <div>
            <label htmlFor="heightCm" className="mb-1.5 block text-sm text-card-light-muted">
              Height (cm)
            </label>
            <input id="heightCm" type="number" inputMode="decimal" className={inputClass} value={form.heightCm} onChange={(e) => update("heightCm", e.target.value)} />
          </div>
          <div>
            <label htmlFor="age" className="mb-1.5 block text-sm text-card-light-muted">
              Age
            </label>
            <input id="age" type="number" inputMode="numeric" className={inputClass} value={form.age} onChange={(e) => update("age", e.target.value)} />
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-5">
          <p className="text-base font-semibold">A bit about your diet</p>
          <p className="-mt-3 text-xs text-card-light-muted">Optional — for when nutrition guidance is available.</p>
          <fieldset>
            <legend className="mb-1.5 block text-sm text-card-light-muted">Meals per day</legend>
            <div className="grid grid-cols-3 gap-2">
              {["2", "3", "4", "5", "6+"].map((label) => {
                const value = label === "6+" ? "6" : label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => update("mealCountPreference", value)}
                    className={optionClass(form.mealCountPreference === value)}
                  >
                    <span className="block text-center">{label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div>
            <label htmlFor="foodAllergies" className="mb-1.5 block text-sm text-card-light-muted">
              Food allergies
            </label>
            <textarea
              id="foodAllergies"
              rows={2}
              placeholder="None"
              className={inputClass}
              value={form.foodAllergies}
              onChange={(e) => update("foodAllergies", e.target.value)}
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 block text-sm text-card-light-muted">Dietary preference</legend>
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
          </fieldset>

          {/* Privacy Policy consent (2026-09-03, moved here from a
              separate gate the first time a member opened the Coach
              bubble — Carl: onboarding is a better place to ask than
              ambushing them later). Required to finish, same wording as
              privacy-consent-form.tsx (which this replaces for anyone who
              completes onboarding through here). */}
          <label className="flex items-start gap-3 border-t border-card-light-border pt-5 text-sm text-card-light-muted">
            <input
              type="checkbox"
              checked={form.agreedToPrivacy}
              onChange={(e) => update("agreedToPrivacy", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-card-light-border"
            />
            I have read and agree to the{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              Privacy Policy
            </a>
            , including Pod Coach&apos;s use of AI to generate advice from my data.
          </label>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-lg border border-card-light-border px-4 py-3 text-sm font-semibold text-card-light-foreground">
            Back
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button type="button" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)} className={buttonClass}>
            Continue
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading || !form.agreedToPrivacy} className={buttonClass}>
            {loading ? "Saving..." : "Finish"}
          </button>
        )}
      </div>
    </div>
  );
}
