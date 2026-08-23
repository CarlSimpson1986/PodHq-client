"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RPE_SCALE } from "@/lib/coach/types";
import { EXERCISE_CATALOG, getExerciseImages, getSafetyTip, getYoutubeVideoId, type CatalogExercise } from "@/lib/coach/exercise-catalog";
import { WARMUP_ITEMS, COOLDOWN_ITEMS } from "@/lib/coach/warmup-cooldown";

// How long each frame shows before auto-switching — reads as motion
// without needing a real animated asset (the source images are two
// static JPGs, see exercise-catalog.ts).
const IMAGE_FRAME_MS = 900;

interface WorkoutSet {
  id: number;
  setNumber: number;
  repsTarget: number;
  weightTargetKg: number;
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

interface WorkoutSessionDetail {
  sessionId: number;
  status: string;
  exercises: WorkoutExercise[];
  excludedExerciseKeys: string[];
}

interface WeightChange {
  name: string;
  oldWeightKg: number;
  newWeightKg: number;
  lastRpe: number | null;
}

type Phase = "loading" | "error" | "intro" | "overview" | "warmup" | "active" | "rpe" | "cooldown" | "summary";

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
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [introNarration, setIntroNarration] = useState<string | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [imageFrame, setImageFrame] = useState<0 | 1>(0);
  const [logging, setLogging] = useState(false);
  const [summary, setSummary] = useState<{ totalVolumeKg: number; changes: WeightChange[]; narration: string | null } | null>(null);
  const [warmupEnabled, setWarmupEnabled] = useState(false);
  const [cooldownEnabled, setCooldownEnabled] = useState(false);
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());
  const [swappingExerciseId, setSwappingExerciseId] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const res = await fetch("/api/member/workout/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        const body = await res.json();
        if (cancelled) return;
        if (body.status !== "ok") {
          setErrorMessage(
            body.message === "coach_profile_missing" ? "Set up your AI Coach first." : body.message ?? "Something went wrong."
          );
          setPhase("error");
          return;
        }
        setDetail(body.session);
        setIntroNarration(body.introNarration);
        const firstSet = body.session.exercises[0]?.sets[0];
        setReps(firstSet?.repsTarget ?? 0);
        setWeight(firstSet?.weightTargetKg ?? 0);
        setPhase(body.introNarration ? "intro" : "overview");
      } catch {
        if (!cancelled) {
          setErrorMessage("Something went wrong. Try again.");
          setPhase("error");
        }
      }
    }
    generate();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

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
            setWeight(resumeSet?.weightTargetKg ?? 0);
            setImageFrame(0);
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
      setWeight(nextExercise.sets[0].weightTargetKg);
      setImageFrame(0);
      setPhase("active");
    } else {
      const nextSet = exercise.sets[setIndex + 1];
      setSetIndex((i) => i + 1);
      setReps(nextSet.repsTarget);
      setWeight(nextSet.weightTargetKg);
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
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?rel=0`}
            title={`${exercise.name} technique demonstration`}
            className="h-full w-full"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setImageFrame((f) => (f === 0 ? 1 : 0))}
          className="block w-full overflow-hidden rounded-lg border border-card-light-border"
          aria-label="Tap to switch position now"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small local static asset, no next/image usage elsewhere in this codebase */}
          <img src={images[imageFrame]} alt={`${exercise.name} — position ${imageFrame + 1} of 2`} className="w-full" />
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
            className={inputClass}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
        </div>
      </div>

      {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

      <button
        type="button"
        disabled={logging}
        onClick={() => (isLastSetOfExercise ? setPhase("rpe") : logCurrentSet())}
        className={buttonClass}
      >
        {logging ? "Saving..." : "Log Set"}
      </button>
    </div>
  );
}
