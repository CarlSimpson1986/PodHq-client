"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RPE_SCALE } from "@/lib/coach/types";

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
}

interface WeightChange {
  name: string;
  oldWeightKg: number;
  newWeightKg: number;
  lastRpe: number | null;
}

type Phase = "loading" | "error" | "intro" | "active" | "rpe" | "summary";

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-center text-lg font-semibold text-card-light-foreground focus:border-card-light-foreground focus:outline-none";

export function WorkoutView({ bookingId }: { bookingId: number }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [introNarration, setIntroNarration] = useState<string | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [logging, setLogging] = useState(false);
  const [summary, setSummary] = useState<{ totalVolumeKg: number; changes: WeightChange[]; narration: string | null } | null>(null);

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
        setPhase(body.introNarration ? "intro" : "active");
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
        <p className="text-base font-medium">{introNarration}</p>
        <button type="button" className={buttonClass} onClick={() => setPhase("active")}>
          Let&apos;s go →
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
        finishSession();
        return;
      }
      const nextExercise = detail!.exercises[exerciseIndex + 1];
      setExerciseIndex((i) => i + 1);
      setSetIndex(0);
      setReps(nextExercise.sets[0].repsTarget);
      setWeight(nextExercise.sets[0].weightTargetKg);
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
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
          Exercise {exerciseIndex + 1} of {detail.exercises.length}
        </p>
        <p className="mt-1 text-xl font-semibold">{exercise.name}</p>
        <p className="text-sm text-card-light-muted">
          Set {setIndex + 1} of {exercise.sets.length}
        </p>
      </div>

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
