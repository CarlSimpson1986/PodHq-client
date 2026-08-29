"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RPE_SCALE } from "@/lib/coach/types";
import {
  EXERCISE_CATALOG,
  MUSCLE_GROUPS,
  getExerciseImages,
  getSafetyTip,
  getYoutubeVideoId,
  getYoutubeEmbedTiming,
  type CatalogExercise,
  type MuscleGroup,
} from "@/lib/coach/exercise-catalog";
import { WARMUP_ITEMS, COOLDOWN_ITEMS } from "@/lib/coach/warmup-cooldown";

// How long each frame shows before auto-switching — reads as motion
// without needing a real animated asset (the source images are two
// static JPGs, see exercise-catalog.ts).
const IMAGE_FRAME_MS = 900;

interface WorkoutSet {
  id: number;
  setNumber: number;
  repsTarget: number;
  // null the first time a member does this exercise — genuinely blank,
  // not a guessed default (see generate-workout.ts's GeneratedExercise).
  weightTargetKg: number | null;
  repsActual: number | null;
  weightActualKg: number | null;
  rpe: number | null;
  completedAt: string | null;
}

interface WorkoutExercise {
  id: number;
  key: string;
  name: string;
  muscleGroup: string;
  sets: WorkoutSet[];
}

type RecoveryAdvice = { kind: "low_recovery"; reason: "elevated_resting_hr" | "low_sleep" } | { kind: "normal" } | { kind: "insufficient_data" };

interface WorkoutSessionDetail {
  sessionId: number;
  status: string;
  exercises: WorkoutExercise[];
  excludedExerciseKeys: string[];
  recoveryAdvice: RecoveryAdvice;
}

const RECOVERY_REASON_COPY: Record<"elevated_resting_hr" | "low_sleep", string> = {
  elevated_resting_hr: "your resting heart rate is up from your usual",
  low_sleep: "you slept less than usual",
};

interface WeightChange {
  name: string;
  oldWeightKg: number;
  newWeightKg: number;
  lastRpe: number | null;
}

// Stage 3 (2026-08-29) — "choose"/"focus-pick"/"custom-pick" are the new
// pre-generation phases; every phase after "loading" is unchanged.
type Phase = "choose" | "focus-pick" | "custom-pick" | "loading" | "error" | "intro" | "overview" | "warmup" | "active" | "rpe" | "cooldown" | "summary";

type GenerateChoice =
  | { mode: "default" }
  | { mode: "focus"; focusMuscleGroups: MuscleGroup[] }
  | { mode: "custom"; customExerciseKeys: string[] };

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-center text-lg font-semibold text-card-light-foreground focus:border-card-light-foreground focus:outline-none";

// A member can exit at any point once a session exists — every logged
// set is already persisted immediately (log-set is an UPDATE on a
// pre-existing row), so there's nothing destructive to confirm. Matches
// CoachBottomNav's own Exit convention (same destination, "/").
function ExitLink() {
  return (
    <Link href="/" className="inline-block text-xs font-medium text-card-light-muted underline">
      ← Exit
    </Link>
  );
}

// First exercise/set that hasn't been logged yet — used both to resume a
// session that was exited mid-way (instead of always restarting at
// exercise 1) and to decide whether swap/warm-up should still be offered.
function computeResumePoint(detail: WorkoutSessionDetail): { exerciseIndex: number; setIndex: number } {
  for (let ei = 0; ei < detail.exercises.length; ei++) {
    const sets = detail.exercises[ei].sets;
    for (let si = 0; si < sets.length; si++) {
      if (!sets[si].completedAt) return { exerciseIndex: ei, setIndex: si };
    }
  }
  return { exerciseIndex: 0, setIndex: 0 };
}

function hasAnyProgress(detail: WorkoutSessionDetail): boolean {
  return detail.exercises.some((ex) => ex.sets.some((s) => s.completedAt));
}

// Same muscle group, not already excluded by injury, not already used by
// another exercise in this session — the server independently re-checks
// all of this on the actual swap request, this is just what's offered.
function getSwapCandidates(exercise: WorkoutExercise, detail: WorkoutSessionDetail): CatalogExercise[] {
  const usedKeys = new Set(detail.exercises.filter((e) => e.id !== exercise.id).map((e) => e.key));
  return EXERCISE_CATALOG.filter(
    (c) => c.muscleGroup === exercise.muscleGroup && c.key !== exercise.key && !detail.excludedExerciseKeys.includes(c.key) && !usedKeys.has(c.key)
  );
}

export function WorkoutView({ bookingId }: { bookingId: number }) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusSelection, setFocusSelection] = useState<MuscleGroup[]>([]);
  const [customSelection, setCustomSelection] = useState<string[]>([]);
  // null = not yet fetched — distinct from an empty array (a real, if
  // unlikely, "nothing eligible" result).
  const [customExcludedKeys, setCustomExcludedKeys] = useState<string[] | null>(null);
  const [customLoadError, setCustomLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [introNarration, setIntroNarration] = useState<string | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [reps, setReps] = useState(0);
  // "" is a genuine blank, not 0 — the first time a member does an
  // exercise, weightTargetKg is null and this must show an empty field
  // for them to fill in, not a pre-filled "0" that reads as a real
  // target (see workout-session.ts's WorkoutSet comment).
  const [weight, setWeight] = useState<number | "">(0);
  const [imageFrame, setImageFrame] = useState<0 | 1>(0);
  const [imageMissing, setImageMissing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [summary, setSummary] = useState<{ totalVolumeKg: number; changes: WeightChange[]; narration: string | null } | null>(null);
  const [warmupEnabled, setWarmupEnabled] = useState(false);
  const [cooldownEnabled, setCooldownEnabled] = useState(false);
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());
  const [swappingExerciseId, setSwappingExerciseId] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [applyingRecovery, setApplyingRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Fires from the "choose"/"focus-pick"/"custom-pick" phases below, not
  // on mount (2026-08-29 — previously this ran automatically in a mount
  // effect, so a member never got a real choice at all). No cancellation
  // guard, unlike the old mount effect — this fires from a click, same
  // convention as every other button-triggered fetch in this file
  // (handleComplete, logCurrentSet, the swap flow).
  async function generate(choice: GenerateChoice) {
    setPhase("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/member/workout/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, ...choice }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setErrorMessage(
          body.message === "coach_profile_missing"
            ? "Set up your AI Coach first."
            : body.message === "no_eligible_exercises"
              ? "Not enough exercises available for that choice — try a different focus or picks."
              : (body.message ?? "Something went wrong.")
        );
        setPhase("error");
        return;
      }
      setDetail(body.session);
      setIntroNarration(body.introNarration);
      const firstSet = body.session.exercises[0]?.sets[0];
      setReps(firstSet?.repsTarget ?? 0);
      setWeight(firstSet?.weightTargetKg ?? "");
      setPhase(body.introNarration ? "intro" : "overview");
    } catch {
      setErrorMessage("Something went wrong. Try again.");
      setPhase("error");
    }
  }

  // Lazily loads eligible exercises the first time "Build your own" is
  // opened — needs to know what's excluded (injury/equipment) *before* a
  // session exists, which getOrCreateWorkoutSession alone can't offer
  // (see /api/member/workout/eligible-exercises's own comment).
  useEffect(() => {
    if (phase !== "custom-pick" || customExcludedKeys !== null) return;
    let cancelled = false;
    async function loadEligible() {
      try {
        const res = await fetch(`/api/member/workout/eligible-exercises?bookingId=${bookingId}`);
        const body = await res.json();
        if (cancelled) return;
        if (body.status !== "ok") {
          setCustomLoadError(body.message ?? "Couldn't load exercises.");
          return;
        }
        setCustomExcludedKeys(body.excludedExerciseKeys);
      } catch {
        if (!cancelled) setCustomLoadError("Couldn't load exercises. Try again.");
      }
    }
    loadEligible();
    return () => {
      cancelled = true;
    };
  }, [phase, customExcludedKeys, bookingId]);

  // Auto-loops the two demonstration frames while an exercise is active —
  // "should move automatically" (2026-08-23), rather than requiring a tap.
  // Restarts cleanly whenever the exercise changes.
  useEffect(() => {
    if (phase !== "active") return;
    const key = detail?.exercises[exerciseIndex]?.key;
    if (!key || getYoutubeVideoId(key)) return;
    const interval = setInterval(() => setImageFrame((f) => (f === 0 ? 1 : 0)), IMAGE_FRAME_MS);
    return () => clearInterval(interval);
  }, [phase, exerciseIndex, detail]);

  if (phase === "choose") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Choose today&apos;s session</p>
        <div className="space-y-2">
          <button type="button" className={buttonClass} onClick={() => generate({ mode: "default" })}>
            Today&apos;s session
          </button>
          <button
            type="button"
            onClick={() => setPhase("focus-pick")}
            className="w-full rounded-lg border border-card-light-border px-4 py-3 text-base font-semibold text-card-light-foreground hover:bg-card-border/10"
          >
            Focus day
          </button>
          <button
            type="button"
            onClick={() => setPhase("custom-pick")}
            className="w-full rounded-lg border border-card-light-border px-4 py-3 text-base font-semibold text-card-light-foreground hover:bg-card-border/10"
          >
            Build your own
          </button>
        </div>
      </div>
    );
  }

  if (phase === "focus-pick") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Pick 1-2 areas to focus on</p>
        <div className="grid grid-cols-2 gap-2">
          {MUSCLE_GROUPS.map((group) => {
            const selected = focusSelection.includes(group);
            return (
              <button
                key={group}
                type="button"
                onClick={() =>
                  setFocusSelection((prev) => (selected ? prev.filter((g) => g !== group) : prev.length < 2 ? [...prev, group] : prev))
                }
                className={`rounded-lg border px-4 py-3 text-center text-sm font-medium capitalize ${
                  selected
                    ? "border-card-light-foreground bg-card-light-foreground text-white"
                    : "border-card-light-border text-card-light-foreground hover:bg-card-border/10"
                }`}
              >
                {group}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={focusSelection.length === 0}
          className={buttonClass}
          onClick={() => generate({ mode: "focus", focusMuscleGroups: focusSelection })}
        >
          Generate workout →
        </button>
        <button
          type="button"
          onClick={() => {
            setFocusSelection([]);
            setPhase("choose");
          }}
          className="block w-full text-center text-xs font-medium text-card-light-muted underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (phase === "custom-pick") {
    const eligible = customExcludedKeys === null ? null : EXERCISE_CATALOG.filter((e) => !customExcludedKeys.includes(e.key));
    const byGroup = (eligible ?? [])
      .reduce<{ group: MuscleGroup; exercises: CatalogExercise[] }[]>((groups, exercise) => {
        const existing = groups.find((g) => g.group === exercise.muscleGroup);
        if (existing) existing.exercises.push(exercise);
        else groups.push({ group: exercise.muscleGroup, exercises: [exercise] });
        return groups;
      }, [])
      .sort((a, b) => MUSCLE_GROUPS.indexOf(a.group as (typeof MUSCLE_GROUPS)[number]) - MUSCLE_GROUPS.indexOf(b.group as (typeof MUSCLE_GROUPS)[number]));

    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Build your own — pick up to 6</p>
        {customLoadError && <p className="text-sm text-danger">{customLoadError}</p>}
        {eligible === null && !customLoadError && <p className="text-sm text-card-light-muted">Loading exercises...</p>}
        {byGroup.map(({ group, exercises }) => (
          <div key={group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted capitalize">{group}</p>
            <div className="space-y-2">
              {exercises.map((ex) => {
                const selected = customSelection.includes(ex.key);
                return (
                  <button
                    key={ex.key}
                    type="button"
                    disabled={!selected && customSelection.length >= 6}
                    onClick={() =>
                      setCustomSelection((prev) =>
                        selected ? prev.filter((k) => k !== ex.key) : prev.length < 6 ? [...prev, ex.key] : prev
                      )
                    }
                    className={`block w-full rounded-lg border px-4 py-3 text-left text-sm font-medium disabled:opacity-50 ${
                      selected
                        ? "border-card-light-foreground bg-card-light-foreground text-white"
                        : "border-card-light-border text-card-light-foreground hover:bg-card-border/10"
                    }`}
                  >
                    {ex.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={customSelection.length === 0}
          className={buttonClass}
          onClick={() => generate({ mode: "custom", customExerciseKeys: customSelection })}
        >
          Generate workout ({customSelection.length}/6) →
        </button>
        <button
          type="button"
          onClick={() => {
            setCustomSelection([]);
            setPhase("choose");
          }}
          className="block w-full text-center text-xs font-medium text-card-light-muted underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (phase === "loading") {
    return <p className="text-center text-sm text-card-light-muted">Building your workout...</p>;
  }

  if (phase === "error") {
    return (
      <div className="text-center">
        <p className="text-sm text-danger">{errorMessage}</p>
        {errorMessage?.includes("AI Coach") && (
          <Link href="/coach-onboarding" className="mt-3 inline-block text-sm font-semibold underline">
            Set up my AI Coach
          </Link>
        )}
        {/* A focus/custom pick that turned out ineligible is retriable —
            unlike a missing coach profile or a network hiccup, going back
            to "choose" and picking again is the actual fix. */}
        {errorMessage?.includes("try a different") && (
          <button type="button" onClick={() => setPhase("choose")} className="mt-3 inline-block text-sm font-semibold underline">
            ← Choose again
          </button>
        )}
      </div>
    );
  }

  if (!detail) return null;

  if (phase === "intro") {
    return (
      <div className="space-y-5 text-center">
        <ExitLink />
        <p className="text-base font-medium">{introNarration}</p>
        <button type="button" className={buttonClass} onClick={() => setPhase("overview")}>
          Let&apos;s go →
        </button>
      </div>
    );
  }

  const hasProgress = hasAnyProgress(detail);

  if (phase === "overview") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">{hasProgress ? "Continue today's session" : "Today's session"}</p>

        {!hasProgress && !recoveryDismissed && detail.recoveryAdvice.kind === "low_recovery" && (
          <div className="rounded-lg border border-card-light-border bg-card-light-foreground/5 p-4">
            <p className="text-sm font-semibold">Recovery looks low today</p>
            <p className="mt-1 text-sm text-card-light-muted">
              Looks like {RECOVERY_REASON_COPY[detail.recoveryAdvice.reason]} — want to reduce today&apos;s weights a little?
            </p>
            {recoveryError && <p className="mt-2 text-sm text-danger">{recoveryError}</p>}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                disabled={applyingRecovery}
                onClick={async () => {
                  setApplyingRecovery(true);
                  setRecoveryError(null);
                  try {
                    const res = await fetch(`/api/member/workout/${detail.sessionId}/apply-recovery-adjustment`, { method: "POST" });
                    const body = await res.json();
                    if (body.status !== "ok") {
                      setRecoveryError(body.message ?? "Couldn't apply that. Try again.");
                      return;
                    }
                    setDetail(body.session);
                  } catch {
                    setRecoveryError("Couldn't apply that. Try again.");
                  } finally {
                    setApplyingRecovery(false);
                  }
                }}
                className="rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {applyingRecovery ? "Reducing..." : "Reduce today's session"}
              </button>
              <button
                type="button"
                onClick={() => setRecoveryDismissed(true)}
                className="rounded-lg border border-card-light-border px-4 py-2 text-sm font-medium"
              >
                No, keep as planned
              </button>
            </div>
          </div>
        )}

        <ul className="space-y-3">
          {detail.exercises.map((ex, i) => (
            <li key={ex.id} className="rounded-lg border border-card-light-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
                    {i + 1}. {ex.muscleGroup}
                  </p>
                  <p className="text-base font-semibold">{ex.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-card-light-muted">
                    {ex.sets.length}×{ex.sets[0]?.repsTarget}
                  </p>
                  {!hasProgress && (
                    <button
                      type="button"
                      onClick={() => {
                        setSwapError(null);
                        setSwappingExerciseId(swappingExerciseId === ex.id ? null : ex.id);
                      }}
                      className="text-xs font-semibold underline"
                    >
                      Swap
                    </button>
                  )}
                </div>
              </div>
              {swappingExerciseId === ex.id && (
                <div className="mt-3 space-y-2 border-t border-card-light-border pt-3">
                  {getSwapCandidates(ex, detail).length === 0 ? (
                    <p className="text-sm text-card-light-muted">No alternatives available for this muscle group.</p>
                  ) : (
                    getSwapCandidates(ex, detail).map((candidate) => (
                      <button
                        key={candidate.key}
                        type="button"
                        disabled={swapping}
                        onClick={async () => {
                          setSwapping(true);
                          setSwapError(null);
                          try {
                            const res = await fetch(`/api/member/workout/${detail.sessionId}/swap-exercise`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ exerciseId: ex.id, newExerciseKey: candidate.key }),
                            });
                            const body = await res.json();
                            if (body.status !== "ok") {
                              setSwapError(body.message ?? "Couldn't swap that exercise.");
                              return;
                            }
                            setDetail(body.session);
                            setSwappingExerciseId(null);
                          } catch {
                            setSwapError("Couldn't swap that exercise. Try again.");
                          } finally {
                            setSwapping(false);
                          }
                        }}
                        className="block w-full rounded-lg border border-card-light-border px-3 py-2 text-left text-sm hover:bg-card-light-foreground hover:text-white disabled:opacity-50"
                      >
                        {candidate.name}
                      </button>
                    ))
                  )}
                  {swapError && <p className="text-sm text-danger">{swapError}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>

        {!hasProgress && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={warmupEnabled} onChange={(e) => setWarmupEnabled(e.target.checked)} />
            Add a warm-up
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cooldownEnabled} onChange={(e) => setCooldownEnabled(e.target.checked)} />
          Add a cool-down
        </label>

        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            const { exerciseIndex: ri, setIndex: rsi } = computeResumePoint(detail);
            const resumeSet = detail.exercises[ri]?.sets[rsi];
            setExerciseIndex(ri);
            setSetIndex(rsi);
            setReps(resumeSet?.repsTarget ?? 0);
            setWeight(resumeSet?.weightTargetKg ?? "");
            setImageFrame(0);
            setImageMissing(false);
            setCheckedIndices(new Set());
            setPhase(warmupEnabled && !hasProgress ? "warmup" : "active");
          }}
        >
          {hasProgress ? "Resume workout →" : "Start workout →"}
        </button>
      </div>
    );
  }

  if (phase === "warmup") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Warm-up</p>
        <ul className="space-y-3">
          {WARMUP_ITEMS.map((item, i) => (
            <li key={item.name}>
              <button
                type="button"
                onClick={() =>
                  setCheckedIndices((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                className="flex w-full items-center justify-between rounded-lg border border-card-light-border p-4 text-left"
              >
                <div>
                  <p className="text-base font-semibold">{item.name}</p>
                  <p className="text-sm text-card-light-muted">{item.instruction}</p>
                </div>
                <span className={`text-lg ${checkedIndices.has(i) ? "text-success" : "text-card-light-muted"}`}>
                  {checkedIndices.has(i) ? "✓" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={buttonClass} onClick={() => setPhase("active")}>
          Continue →
        </button>
      </div>
    );
  }

  const exercise = detail.exercises[exerciseIndex];
  const currentSet = exercise?.sets[setIndex];
  const isLastSetOfExercise = setIndex === exercise.sets.length - 1;
  const isLastExercise = exerciseIndex === detail.exercises.length - 1;

  async function logCurrentSet(rpe?: number) {
    if (!currentSet) return;
    setLogging(true);
    try {
      await fetch(`/api/member/workout/${detail!.sessionId}/log-set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId: currentSet.id, repsActual: reps, weightActualKg: weight, rpe }),
      });
      advance();
    } catch {
      setErrorMessage("Couldn't save that set. Try again.");
    } finally {
      setLogging(false);
    }
  }

  function advance() {
    if (isLastSetOfExercise) {
      if (isLastExercise) {
        if (cooldownEnabled) {
          setCheckedIndices(new Set());
          setPhase("cooldown");
        } else {
          finishSession();
        }
        return;
      }
      const nextExercise = detail!.exercises[exerciseIndex + 1];
      setExerciseIndex((i) => i + 1);
      setSetIndex(0);
      setReps(nextExercise.sets[0].repsTarget);
      // A different exercise never carries over the previous one's
      // weight — reset to its own target, blank if this is also the
      // first time doing it.
      setWeight(nextExercise.sets[0].weightTargetKg ?? "");
      setImageFrame(0);
      setImageMissing(false);
      setPhase("active");
    } else {
      const nextSet = exercise.sets[setIndex + 1];
      setSetIndex((i) => i + 1);
      setReps(nextSet.repsTarget);
      // A null target here means every set of this exercise is blank
      // (first time doing it, same exercise) — carry forward whatever
      // was just typed for the previous set rather than making the
      // member re-enter the identical number 2-3 times in a row.
      setWeight(nextSet.weightTargetKg ?? weight);
      setPhase("active");
    }
  }

  async function finishSession() {
    setPhase("summary");
    try {
      const res = await fetch(`/api/member/workout/${detail!.sessionId}/complete`, { method: "POST" });
      const body = await res.json();
      if (body.status === "ok") setSummary(body.summary);
    } catch {
      // Summary narration is a nice-to-have — the session itself is
      // already fully logged regardless.
    }
  }

  if (phase === "cooldown") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Cool-down</p>
        <ul className="space-y-3">
          {COOLDOWN_ITEMS.map((item, i) => (
            <li key={item.name}>
              <button
                type="button"
                onClick={() =>
                  setCheckedIndices((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                className="flex w-full items-center justify-between rounded-lg border border-card-light-border p-4 text-left"
              >
                <div>
                  <p className="text-base font-semibold">{item.name}</p>
                  <p className="text-sm text-card-light-muted">{item.instruction}</p>
                </div>
                <span className={`text-lg ${checkedIndices.has(i) ? "text-success" : "text-card-light-muted"}`}>
                  {checkedIndices.has(i) ? "✓" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={buttonClass} onClick={() => finishSession()}>
          Finish →
        </button>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <div className="space-y-5 text-center">
        <p className="text-xl font-semibold">Session complete!</p>
        {summary && (
          <>
            <p className="text-sm text-card-light-muted">
              Total volume: {Math.round(summary.totalVolumeKg)}kg across {detail.exercises.length} exercises
            </p>
            {summary.narration && <p className="rounded-lg border border-card-light-border p-4 text-sm">{summary.narration}</p>}
          </>
        )}
        <Link href="/" className={`${buttonClass} block`}>
          Back to Home
        </Link>
      </div>
    );
  }

  if (phase === "rpe") {
    return (
      <div className="space-y-5 text-center">
        <ExitLink />
        <p className="text-lg font-semibold">How difficult was that set?</p>
        <p className="text-xs text-card-light-muted">Rating your exertion helps personalise next time&apos;s weight.</p>
        <div className="space-y-2">
          {RPE_SCALE.map((r) => (
            <button
              key={r.value}
              type="button"
              disabled={logging}
              onClick={() => logCurrentSet(r.value)}
              className="w-full rounded-lg border border-card-light-border px-4 py-3 text-sm font-medium text-card-light-foreground hover:bg-card-light-foreground hover:text-white disabled:opacity-50"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // phase === "active"
  const images = getExerciseImages(exercise.key);
  const safetyTip = getSafetyTip(exercise.key);
  const youtubeVideoId = getYoutubeVideoId(exercise.key);
  const youtubeTiming = getYoutubeEmbedTiming(exercise.key);
  const youtubeEmbedParams = new URLSearchParams({ rel: "0" });
  if (youtubeTiming.start !== undefined) youtubeEmbedParams.set("start", String(youtubeTiming.start));
  if (youtubeTiming.end !== undefined) youtubeEmbedParams.set("end", String(youtubeTiming.end));
  return (
    <div className="space-y-6">
      <ExitLink />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
          Exercise {exerciseIndex + 1} of {detail.exercises.length}
        </p>
        <p className="mt-1 text-xl font-semibold">{exercise.name}</p>
        <p className="text-sm text-card-light-muted">
          Set {setIndex + 1} of {exercise.sets.length}
        </p>
      </div>

      {youtubeVideoId ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-card-light-border">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?${youtubeEmbedParams.toString()}`}
            title={`${exercise.name} technique demonstration`}
            className="h-full w-full"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : imageMissing ? (
        // A handful of exercises added 2026-08-27 for the A/B/C rotation
        // don't have real position photos sourced yet (see
        // exercise-catalog.ts's own comment) — this reads as an honest
        // "no photo yet" placeholder instead of a broken image icon.
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-card-light-border">
          <p className="px-6 text-center text-sm text-card-light-muted">No photo yet for {exercise.name} — follow the safety tip below.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setImageFrame((f) => (f === 0 ? 1 : 0))}
          className="block w-full overflow-hidden rounded-lg border border-card-light-border"
          aria-label="Tap to switch position now"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small local static asset, no next/image usage elsewhere in this codebase */}
          <img
            src={images[imageFrame]}
            alt={`${exercise.name} — position ${imageFrame + 1} of 2`}
            className="w-full"
            onError={() => setImageMissing(true)}
          />
        </button>
      )}

      {safetyTip && <p className="text-sm text-card-light-muted">⚠ {safetyTip}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="reps" className="mb-1.5 block text-xs text-card-light-muted">
            Reps
          </label>
          <input id="reps" type="number" inputMode="numeric" className={inputClass} value={reps} onChange={(e) => setReps(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="weight" className="mb-1.5 block text-xs text-card-light-muted">
            Weight (kg)
          </label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            placeholder={weight === "" ? "Enter weight" : undefined}
            className={inputClass}
            value={weight}
            onChange={(e) => setWeight(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
      </div>

      {currentSet?.weightTargetKg === null && (
        <p className="text-xs text-card-light-muted">
          First time doing {exercise.name} — try a lighter warm-up set or two first to find a comfortable weight, then log what
          you actually use here. We&apos;ll suggest a starting point from here next time.
        </p>
      )}

      {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

      <button
        type="button"
        disabled={logging || weight === ""}
        onClick={() => (isLastSetOfExercise ? setPhase("rpe") : logCurrentSet())}
        className={buttonClass}
      >
        {logging ? "Saving..." : "Log Set"}
      </button>
    </div>
  );
}
