"use client";

import { useEffect, useRef, useState } from "react";
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
import { useExerciseVideoOverrides } from "@/lib/hooks/use-exercise-video-overrides";
import { ArrowLeftIcon } from "@/components/icons";

// How long each frame shows before auto-switching — reads as motion
// without needing a real animated asset (the source images are two
// static JPGs, see exercise-catalog.ts).
const IMAGE_FRAME_MS = 900;

interface WorkoutSet {
  id: number;
  setNumber: number;
  // Exactly one of these two is ever set — every straight-sets exercise
  // still gets repsTarget as always; durationSeconds is the AMRAP
  // alternative (Stage 2, 2026-08-29): a time-based movement (e.g. a 30s
  // plank hold) prescribed by duration instead of a rep count.
  repsTarget: number | null;
  durationSeconds: number | null;
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
  // Custom-workout member override (Stage 1, 2026-08-29) — null means no
  // rest-timer screen, same self-paced behaviour as before this existed.
  restSeconds: number | null;
  // "Why did this change?" (2026-09-06) — see generate-workout.ts's
  // describeWeightChangeReason. Null for a first-time exercise or a
  // member's own custom/circuit pick.
  weightChangeReason: string | null;
  sets: WorkoutSet[];
}

type RecoveryAdvice = { kind: "low_recovery"; reason: "elevated_resting_hr" | "low_sleep" } | { kind: "normal" } | { kind: "insufficient_data" };

// Pain caution (2026-08-30, coaching review) — surfaces the member's own
// latest weekly check-in "any pain or discomfort" answer on the very next
// workout, naming which of today's actual exercises touch the reported
// area. Advisory only, same posture as RecoveryAdvice — never excludes an
// exercise, just a heads-up with a pointer to swap it out if it's still
// bothering them.
type PainCaution = { kind: "none" } | { kind: "reported"; painDetail: string | null; flaggedExerciseKeys: string[] };

// AMRAP fields (Stage 2, 2026-08-29) — timeCapSeconds is the prescription
// (set at generation), roundsCompleted/partialRoundExerciseIndex/
// partialRoundReps are the self-reported tally, null until completed.
// format defaults to "straight_sets" server-side, so every default/focus/
// straight-sets-custom session reads exactly that, unchanged.
interface WorkoutSessionDetail {
  sessionId: number;
  status: string;
  format: "straight_sets" | "amrap" | "rounds_for_time" | "hiit";
  timeCapSeconds: number | null;
  roundsCompleted: number | null;
  partialRoundExerciseIndex: number | null;
  partialRoundReps: number | null;
  targetRounds: number | null;
  elapsedSeconds: number | null;
  // HIIT (Stage 4, 2026-08-30) — the interval prescription, null for
  // every non-HIIT session.
  workSeconds: number | null;
  restSeconds: number | null;
  restBetweenRoundsSeconds: number | null;
  exercises: WorkoutExercise[];
  excludedExerciseKeys: string[];
  recoveryAdvice: RecoveryAdvice;
  painCaution: PainCaution;
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

// "choose"/"focus-pick"/"custom-pick" started as a pre-generation picker
// (Stage 3, 2026-08-29) and were repurposed the same day into the
// post-generation "Change today's workout" flow instead (see
// changeWorkoutMode's own comment in workout-session.ts for why) —
// "change-warning" is the new program-hopping confirmation in front of
// them. Every session now generates its default plan automatically on
// load; "choose" only ever offers focus/custom from here on, reached
// exclusively via "change-warning".
type Phase =
  | "loading"
  | "change-warning"
  | "choose"
  | "focus-pick"
  | "custom-pick"
  | "error"
  | "intro"
  | "overview"
  | "warmup"
  | "active"
  | "resting"
  | "rpe"
  | "cooldown"
  | "summary"
  | "amrap-active"
  | "amrap-tally"
  | "rft-active"
  | "rft-tally"
  | "hiit-active"
  // HIIT reps tally (2026-08-30, Carl's own follow-up) — unlike AMRAP/
  // RFT's tally, this never gates completion (completeHiitSession has
  // already run automatically by the time this phase is reached); it's
  // purely the optional "log what you remember" step. Reuses "summary"
  // afterward like the other two formats do.
  | "hiit-tally";

type GenerateChoice =
  | { mode: "default" }
  | { mode: "focus"; focusMuscleGroups: MuscleGroup[] }
  | { mode: "custom"; customExerciseKeys: string[]; customExerciseRests?: Record<string, number> }
  | { mode: "custom-amrap"; timeCapSeconds: number; amrapExercises: { key: string; reps?: number; durationSeconds?: number; weightKg?: number }[] }
  // Rounds-For-Time (Stage 3, 2026-08-30; corrected same day — real RFT
  // WODs always carry a time cap, so timeCapSeconds is required here too
  // now) — serializes its exercise list under the same `amrapExercises`
  // key as custom-amrap, NOT `rftExercises` — the server schema reuses
  // that one field name for both circuit formats (see
  // validation/workout.ts). Stage 2's own writeup hit exactly this kind
  // of client/server field-name mismatch once already; don't repeat it.
  | {
      mode: "custom-rft";
      targetRounds: number;
      timeCapSeconds: number;
      amrapExercises: { key: string; reps?: number; weightKg?: number }[];
    }
  // HIIT (Stage 4, 2026-08-30) — a genuinely different shape from
  // AMRAP/RFT's amrapExercises: no per-exercise reps/duration/weight at
  // all, just the picked keys (work/rest/rounds apply uniformly). Gets
  // its own payload key, hiitExerciseKeys, deliberately NOT reusing
  // amrapExercises — see the comment above about that exact mismatch bug.
  | {
      mode: "custom-hiit";
      workSeconds: number;
      restSeconds: number;
      targetRounds: number;
      restBetweenRoundsSeconds: number;
      hiitExerciseKeys: string[];
    };

// Rest defaults offered in the custom builder (Stage 1, 2026-08-29) — same
// two values Carl set for Hypertrophy's assumed rest (see
// REST_SECONDS_BY_BLOCK in types.ts), offered here as member-adjustable
// starting points rather than baked in.
const DEFAULT_REST_SECONDS = 90;

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-center text-lg font-semibold text-card-light-foreground focus:border-card-light-foreground focus:outline-none";

// A member can exit at any point once a session exists — every logged
// set is already persisted immediately (log-set is an UPDATE on a
// pre-existing row), so there's nothing destructive to confirm. Matches
// CoachBottomNav's own Exit convention (same destination, "/").
// A plain underlined text link was too easy to miss as "the way back to
// Home" (Carl, 2026-09-06, testing the workout flow) — an icon + label
// reads unambiguously as a real back button, same ArrowLeftIcon already
// reserved for exactly this "leave this nav, go back" case (see its own
// comment in icons.tsx).
function ExitLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-card-light-foreground">
      <ArrowLeftIcon className="h-4 w-4" />
      Home
    </Link>
  );
}

// Pain caution banner (2026-08-30, coaching review) — shared across every
// overview screen (straight-sets, AMRAP, RFT) rather than three near-copies,
// since the only real difference between them is whether a swap is even
// possible: straight-sets exercises can be swapped per-exercise on this
// same screen (allowSwap points there); AMRAP/RFT exercises are fixed once
// generated (see their own overview comments), so that screen just says
// "go easy" instead of pointing at a control that doesn't exist there.
function PainCautionBanner({ detail, allowSwap }: { detail: WorkoutSessionDetail; allowSwap: boolean }) {
  if (detail.painCaution.kind !== "reported") return null;
  const flaggedNames = detail.painCaution.flaggedExerciseKeys
    .map((key) => detail.exercises.find((e) => e.key === key)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
      <p className="text-sm font-semibold">Heads up</p>
      <p className="mt-1 text-sm text-card-light-muted">
        {flaggedNames.length > 0 ? (
          <>
            You mentioned {detail.painCaution.painDetail ?? "some pain or discomfort"} at your last check-in. If it&apos;s still
            bothering you, go easy on{allowSwap ? " (or swap out below)" : ""} {flaggedNames.join(", ")}.
          </>
        ) : (
          <>
            You mentioned some pain or discomfort at your last check-in. If it&apos;s still bothering you, go easy today
            {allowSwap ? " and swap out anything that aggravates it" : ""}.
          </>
        )}
      </p>
    </div>
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
  const exerciseVideoOverrides = useExerciseVideoOverrides();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusSelection, setFocusSelection] = useState<MuscleGroup[]>([]);
  const [customSelection, setCustomSelection] = useState<string[]>([]);
  const [customRests, setCustomRests] = useState<Record<string, number>>({});
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  // AMRAP builder + taking-the-workout state (Stage 2, 2026-08-29).
  // customFormat is 4-way (Stage 3, 2026-08-30; HIIT added Stage 4) —
  // "amrap"/"rounds_for_time"/"hiit" are all Cardio sub-modes, sharing
  // customSelection; only entering/leaving "straight_sets" clears the
  // exercise picks. customAmrapConfig (per-exercise reps/duration/weight)
  // is AMRAP/RFT-only — HIIT has no per-exercise config at all, its
  // work/rest/rounds/rest-between-rounds fields (below) apply uniformly.
  const [customFormat, setCustomFormat] = useState<"straight_sets" | "amrap" | "rounds_for_time" | "hiit">("straight_sets");
  const [amrapTimeCapMinutes, setAmrapTimeCapMinutes] = useState(12);
  const [customAmrapConfig, setCustomAmrapConfig] = useState<Record<string, { unit: "reps" | "duration"; value: number; weightKg: number | "" }>>({});
  const [amrapSecondsRemaining, setAmrapSecondsRemaining] = useState(0);
  const [amrapRoundsCompleted, setAmrapRoundsCompleted] = useState<number | "">(0);
  const [amrapPartialIndex, setAmrapPartialIndex] = useState<number | "">("");
  const [amrapPartialReps, setAmrapPartialReps] = useState<number | "">("");
  const [amrapSubmitting, setAmrapSubmitting] = useState(false);
  // Rounds-For-Time builder + taking-the-workout state (Stage 3,
  // 2026-08-30; corrected same day — real RFT WODs carry a time cap, so a
  // member can fail to finish). rftSecondsElapsed is a stopwatch counting
  // UP (unlike amrapSecondsRemaining's countdown) — it's the visible
  // "how long" tracker in both outcomes: it stops naturally under the cap
  // on a real finish, or is pinned at rftCapSeconds if the cap is hit.
  // rftCapSeconds is seeded from the session's own timeCapSeconds when
  // "Start" is tapped (mirrors amrapSecondsRemaining's own seeding), kept
  // as separate local state so the tick effect below doesn't need
  // `detail` in its deps. rftRoundsCompleted/rftPartialIndex/
  // rftPartialReps mirror AMRAP's own tally fields exactly — only used on
  // the capped-out path (rft-tally); a normal finish never touches them.
  const [rftTargetRounds, setRftTargetRounds] = useState(4);
  const [rftTimeCapMinutes, setRftTimeCapMinutes] = useState(12);
  const [rftSecondsElapsed, setRftSecondsElapsed] = useState(0);
  const [rftCapSeconds, setRftCapSeconds] = useState(0);
  const [rftRoundsCompleted, setRftRoundsCompleted] = useState<number | "">(0);
  const [rftPartialIndex, setRftPartialIndex] = useState<number | "">("");
  const [rftPartialReps, setRftPartialReps] = useState<number | "">("");
  const [rftSubmitting, setRftSubmitting] = useState(false);
  // HIIT builder + taking-the-workout state (Stage 4, 2026-08-30). Unlike
  // AMRAP/RFT there's no per-exercise config — work/rest/rounds/
  // rest-between-rounds are set once and apply uniformly as the sequencer
  // cycles the picked exercises. hiitCurrentRound/hiitCurrentExerciseIndex/
  // hiitSubPhase are the sequencer's own state machine (see the tick
  // effect below); hiitSecondsRemaining counts down within whichever
  // sub-phase is currently active. Completion itself is a plain "I
  // finished" POST with no self-reported data — hiitRepsInput below is a
  // separate, optional follow-up (2026-08-30) that never gates or delays
  // that POST, keyed by exerciseId, "" meaning "not filled in" (distinct
  // from a genuine 0 reps).
  const [hiitWorkSeconds, setHiitWorkSeconds] = useState(30);
  const [hiitRestSeconds, setHiitRestSeconds] = useState(15);
  const [hiitRounds, setHiitRounds] = useState(4);
  const [hiitRestBetweenRoundsSeconds, setHiitRestBetweenRoundsSeconds] = useState(30);
  const [hiitCurrentRound, setHiitCurrentRound] = useState(1);
  const [hiitCurrentExerciseIndex, setHiitCurrentExerciseIndex] = useState(0);
  const [hiitSubPhase, setHiitSubPhase] = useState<"work" | "rest" | "rest_between_rounds">("work");
  const [hiitSecondsRemaining, setHiitSecondsRemaining] = useState(0);
  const [hiitRepsInput, setHiitRepsInput] = useState<Record<number, string>>({});
  const [hiitLoggedReps, setHiitLoggedReps] = useState<Record<number, number>>({});
  const [hiitTallySubmitting, setHiitTallySubmitting] = useState(false);
  // A ref, not state — this is a fire-once completion guard the UI never
  // needs to reflect (HIIT's summary has no "Saving..." state the way
  // RFT's manual Finished! button does), and reading+writing the same
  // piece of state inside the effect that also depends on it is exactly
  // the cascading-render pattern react-hooks/set-state-in-effect flags.
  const hiitSubmittingRef = useRef(false);
  // Holds the latest applyAdvance closure — applyAdvance itself is only
  // defined later, after `detail` is known non-null, but the rest-timer
  // effect below has to be declared unconditionally up here alongside
  // this file's other hooks (Rules of Hooks). Updated every render via
  // the plain assignment right before applyAdvance's own definition.
  const applyAdvanceRef = useRef<() => void>(() => {});
  // setPhase itself is a stable identity (React guarantees this), so
  // unlike applyAdvanceRef this only ever needs to be set once — the
  // AMRAP countdown's target phase never depends on late-computed values.
  const goToAmrapTallyRef = useRef(() => setPhase("amrap-tally"));
  // Same reasoning as goToAmrapTallyRef — the RFT stopwatch auto-transitions
  // to the capped-out tally once it reaches the session's time cap.
  const goToRftTallyRef = useRef(() => setPhase("rft-tally"));
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
  // Overview's three-section accordion (2026-09-06, Carl's design pass) —
  // warm-up/cool-down are always part of the flow now (no opt-in
  // checkbox) — a member who doesn't want one uses the section's own
  // "Skip" link once they're actually in it, rather than pre-deciding on
  // the overview screen.
  // main workout open by default since that's the primary content;
  // warm-up/stretching start collapsed, just a preview until expanded.
  const [expandedSections, setExpandedSections] = useState<{ warmup: boolean; main: boolean; cooldown: boolean }>({
    warmup: false,
    main: true,
    cooldown: false,
  });
  // Warm-up/cool-down step through one item at a time (2026-09-06, Carl's
  // call — same one-exercise-at-a-time flow as the main workout, instead
  // of the original full-checklist screen) — each index resets to 0 on
  // entering its phase, see the setPhase("warmup"/"cooldown") call sites.
  const [warmupItemIndex, setWarmupItemIndex] = useState(0);
  const [cooldownItemIndex, setCooldownItemIndex] = useState(0);
  const [swappingExerciseId, setSwappingExerciseId] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [applyingRecovery, setApplyingRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const generateStarted = useRef(false);

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

  // "Change today's workout" (2026-08-29) — only ever called from
  // focus-pick/custom-pick when they were reached via the change-warning
  // flow (a session already exists at that point), hitting the
  // replace-in-place endpoint instead of the first-time generate one.
  async function changeMode(choice: GenerateChoice) {
    setPhase("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/member/workout/change-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, ...choice }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setErrorMessage(
          body.message === "session_already_started"
            ? "You've already started this session — finish or exit it before changing today's workout."
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

  // Generates the default plan automatically on mount (2026-08-29) — the
  // pre-generation choose screen this used to require is gone; every
  // booking's session is ready the moment the member opens it. The ref
  // guard exists purely for React Strict Mode's dev-only double-effect
  // fire — a genuine double POST would still resolve safely via
  // getOrCreateWorkoutSession's own race recovery, this just avoids a
  // redundant request in dev.
  useEffect(() => {
    if (generateStarted.current) return;
    generateStarted.current = true;
    generate({ mode: "default" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Rest countdown (custom workouts, Stage 1, 2026-08-29) — ticks once a
  // second while phase is "resting"; hitting zero runs the exact same
  // advance the member gets by tapping "Skip rest" (applyAdvanceRef.current,
  // set just before applyAdvance's own definition below), so there's only
  // one place that decides what "after rest" means.
  useEffect(() => {
    if (phase !== "resting") return;
    if (restSecondsRemaining <= 0) {
      applyAdvanceRef.current();
      return;
    }
    const timer = setTimeout(() => setRestSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, restSecondsRemaining]);

  // AMRAP countdown (Stage 2, 2026-08-29) — ticks once a second while
  // phase is "amrap-active"; hitting zero always goes to the same place
  // (the tally screen), so unlike the rest-timer above this needs no ref
  // indirection — the target phase never depends on late-computed values.
  useEffect(() => {
    if (phase !== "amrap-active") return;
    if (amrapSecondsRemaining <= 0) {
      goToAmrapTallyRef.current();
      return;
    }
    const timer = setTimeout(() => setAmrapSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, amrapSecondsRemaining]);

  // Rounds-For-Time stopwatch (Stage 3, 2026-08-30; corrected same day —
  // real RFT WODs carry a time cap) — ticks UP once a second while phase
  // is "rft-active" (the visible "how long" tracker), but stops and
  // auto-transitions to the capped-out tally once it reaches rftCapSeconds
  // — same ref-held target-phase pattern as the AMRAP countdown's own
  // auto-advance-at-zero, just checking the opposite bound.
  useEffect(() => {
    if (phase !== "rft-active") return;
    if (rftSecondsElapsed >= rftCapSeconds) {
      goToRftTallyRef.current();
      return;
    }
    const timer = setTimeout(() => setRftSecondsElapsed((s) => s + 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, rftSecondsElapsed, rftCapSeconds]);

  // HIIT sequencer (Stage 4, 2026-08-30) — ticks once a second while
  // phase is "hiit-active", counting DOWN within whichever sub-phase is
  // currently active (unlike AMRAP's single countdown or RFT's single
  // stopwatch, this one has to advance a small state machine: work → rest
  // → work → ... → work (last exercise, no trailing rest) → rest between
  // rounds (skipped if 0s, and never played after the final round) → next
  // round). Every branch's setState calls run inside the same setTimeout
  // callback as the plain 1s tick (0ms delay when a transition is due
  // right now) rather than synchronously in the effect body — same shape
  // AMRAP/RFT's own tick effects already use for their single counter
  // update, just applied to every branch here instead of one. Calling
  // setState synchronously in an effect body trips
  // react-hooks/set-state-in-effect (cascading-render risk); deferring
  // via setTimeout sidesteps that the same way the existing 1000ms delay
  // already does for the simple countdown case. The terminal transition
  // (last exercise, last round, work phase ending) submits completion
  // itself — hiitSubmittingRef guards against a duplicate POST while that
  // request is in flight (a plain ref, not state, so it isn't itself a
  // dependency this effect has to re-run for).
  useEffect(() => {
    if (phase !== "hiit-active") return;

    const timer = setTimeout(
      () => {
        if (hiitSecondsRemaining > 0) {
          setHiitSecondsRemaining((s) => s - 1);
          return;
        }

        const exerciseCount = detail?.exercises.length ?? 0;

        if (hiitSubPhase === "work") {
          const isLastExercise = hiitCurrentExerciseIndex >= exerciseCount - 1;
          if (isLastExercise) {
            const isLastRound = hiitCurrentRound >= hiitRounds;
            if (isLastRound) {
              if (hiitSubmittingRef.current) return;
              hiitSubmittingRef.current = true;
              (async () => {
                try {
                  await fetch(`/api/member/workout/${detail!.sessionId}/complete-hiit`, { method: "POST" });
                } catch {
                  // The sequencer already ran the full prescription — a
                  // failed POST just means the session stays "generated"
                  // server-side rather than blocking the member from
                  // seeing their summary.
                } finally {
                  // hiit-tally (2026-08-30) is purely optional logging —
                  // completion above already happened unconditionally, so
                  // a failed POST doesn't change where this goes next.
                  setPhase("hiit-tally");
                }
              })();
              return;
            }
            if (hiitRestBetweenRoundsSeconds > 0) {
              setHiitSubPhase("rest_between_rounds");
              setHiitSecondsRemaining(hiitRestBetweenRoundsSeconds);
            } else {
              setHiitCurrentRound((r) => r + 1);
              setHiitCurrentExerciseIndex(0);
              setHiitSecondsRemaining(hiitWorkSeconds);
            }
            return;
          }
          if (hiitRestSeconds > 0) {
            setHiitSubPhase("rest");
            setHiitSecondsRemaining(hiitRestSeconds);
          } else {
            setHiitCurrentExerciseIndex((i) => i + 1);
            setHiitSecondsRemaining(hiitWorkSeconds);
          }
          return;
        }

        if (hiitSubPhase === "rest") {
          setHiitCurrentExerciseIndex((i) => i + 1);
          setHiitSubPhase("work");
          setHiitSecondsRemaining(hiitWorkSeconds);
          return;
        }

        // rest_between_rounds finished — next round starts back at the first exercise.
        setHiitCurrentRound((r) => r + 1);
        setHiitCurrentExerciseIndex(0);
        setHiitSubPhase("work");
        setHiitSecondsRemaining(hiitWorkSeconds);
      },
      hiitSecondsRemaining > 0 ? 1000 : 0
    );
    return () => clearTimeout(timer);
  }, [
    phase,
    hiitSecondsRemaining,
    hiitSubPhase,
    hiitCurrentExerciseIndex,
    hiitCurrentRound,
    hiitRounds,
    hiitWorkSeconds,
    hiitRestSeconds,
    hiitRestBetweenRoundsSeconds,
    detail,
  ]);

  if (phase === "change-warning") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Change today&apos;s workout?</p>
        <div className="rounded-lg border border-warning/50 p-4">
          <p className="text-sm font-medium">Program-hopping may reduce your progress.</p>
          <p className="mt-1 text-sm text-card-light-muted">
            Your Hypertrophy/Strength rotation is built to progress week over week — switching off it for today is fine
            occasionally, but doing it often can slow your results.
          </p>
        </div>
        <button type="button" className={buttonClass} onClick={() => setPhase("choose")}>
          Continue anyway →
        </button>
        <button type="button" onClick={() => setPhase("overview")} className="block w-full text-center text-xs font-medium text-card-light-muted underline">
          ← Never mind, keep today&apos;s plan
        </button>
      </div>
    );
  }

  if (phase === "choose") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Change today&apos;s session</p>
        <div className="space-y-2">
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
        <button type="button" onClick={() => setPhase("overview")} className="block w-full text-center text-xs font-medium text-card-light-muted underline">
          ← Back
        </button>
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
          onClick={() => changeMode({ mode: "focus", focusMuscleGroups: focusSelection })}
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
    // Weights vs Cardio (2026-08-29, Carl's call) — the top-level choice,
    // not a format picker buried below the exercise list. Weights =
    // straight sets, picking from the resistance-training catalog (what
    // "Build your own" always offered). Cardio = a conditioning circuit,
    // picking only from isConditioning-tagged real HIIT/CrossFit
    // movements — a genuinely different exercise pool, not the same
    // catalog relabeled. Cardio itself has two clock styles (Stage 3,
    // 2026-08-30): AMRAP (countdown, open-ended rounds) and Rounds For
    // Time (stopwatch, fixed rounds) — see the nested toggle below.
    const eligible =
      customExcludedKeys === null
        ? null
        : EXERCISE_CATALOG.filter((e) => !customExcludedKeys.includes(e.key) && e.isConditioning === (customFormat !== "straight_sets"));
    const byGroup = (eligible ?? [])
      .reduce<{ group: MuscleGroup; exercises: CatalogExercise[] }[]>((groups, exercise) => {
        const existing = groups.find((g) => g.group === exercise.muscleGroup);
        if (existing) existing.exercises.push(exercise);
        else groups.push({ group: exercise.muscleGroup, exercises: [exercise] });
        return groups;
      }, [])
      .sort((a, b) => MUSCLE_GROUPS.indexOf(a.group as (typeof MUSCLE_GROUPS)[number]) - MUSCLE_GROUPS.indexOf(b.group as (typeof MUSCLE_GROUPS)[number]));

    // Circuit-config helper — seeds a sensible default the first time an
    // exercise is selected under Cardio, otherwise reads back whatever the
    // member already set. AMRAP defaults to duration ("30 seconds of X") —
    // HIIT/circuit work is naturally time-based there. RFT is always reps
    // (real RFT WODs prescribe reps per round, never a timed hold — see
    // generateCircuitSession's own comment), so it defaults to a rep count
    // instead and the builder never offers a Duration option for it.
    function amrapConfigFor(key: string) {
      return (
        customAmrapConfig[key] ??
        (customFormat === "rounds_for_time" ? { unit: "reps" as const, value: 10, weightKg: "" as const } : { unit: "duration" as const, value: 30, weightKg: "" as const })
      );
    }

    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">Build your own — pick up to 6</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (customFormat === "amrap") {
                setCustomSelection([]);
                setCustomAmrapConfig({});
              }
              setCustomFormat("straight_sets");
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
              customFormat === "straight_sets" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border"
            }`}
          >
            Weights
          </button>
          <button
            type="button"
            onClick={() => {
              if (customFormat === "straight_sets") {
                setCustomSelection([]);
                setCustomRests({});
                setCustomFormat("amrap");
              }
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
              customFormat !== "straight_sets" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border"
            }`}
          >
            Cardio
          </button>
        </div>

        {customFormat !== "straight_sets" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                // Config entries don't carry over between the two Cardio
                // sub-modes — AMRAP defaults to duration, RFT is reps-only,
                // so a stale "30 seconds" entry from AMRAP would be wrong
                // (and invalid) if left in place for RFT.
                if (customFormat !== "amrap") setCustomAmrapConfig({});
                setCustomFormat("amrap");
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                customFormat === "amrap" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border"
              }`}
            >
              AMRAP
            </button>
            <button
              type="button"
              onClick={() => {
                if (customFormat !== "rounds_for_time") setCustomAmrapConfig({});
                setCustomFormat("rounds_for_time");
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                customFormat === "rounds_for_time" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border"
              }`}
            >
              Rounds For Time
            </button>
            <button
              type="button"
              onClick={() => {
                // HIIT has no per-exercise config at all — clear any
                // leftover AMRAP/RFT entries same as switching between
                // those two already does.
                if (customFormat !== "hiit") setCustomAmrapConfig({});
                setCustomFormat("hiit");
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                customFormat === "hiit" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border"
              }`}
            >
              HIIT
            </button>
          </div>
        )}

        {customFormat === "amrap" && (
          <div className="flex items-center gap-2">
            <label htmlFor="amrap-time-cap" className="text-sm text-card-light-muted">
              As many rounds as possible in
            </label>
            <input
              id="amrap-time-cap"
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={amrapTimeCapMinutes}
              onChange={(e) => setAmrapTimeCapMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
              className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
            />
            <span className="text-sm text-card-light-muted">minutes</span>
          </div>
        )}

        {customFormat === "rounds_for_time" && (
          <>
            <div className="flex items-center gap-2">
              <label htmlFor="rft-target-rounds" className="text-sm text-card-light-muted">
                Complete
              </label>
              <input
                id="rft-target-rounds"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={rftTargetRounds}
                onChange={(e) => setRftTargetRounds(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
              />
              <span className="text-sm text-card-light-muted">rounds for time</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="rft-time-cap" className="text-sm text-card-light-muted">
                Time cap
              </label>
              <input
                id="rft-time-cap"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={rftTimeCapMinutes}
                onChange={(e) => setRftTimeCapMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
                className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
              />
              <span className="text-sm text-card-light-muted">minutes</span>
            </div>
          </>
        )}

        {customFormat === "hiit" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="hiit-work-seconds" className="text-sm text-card-light-muted">
                Work
              </label>
              <input
                id="hiit-work-seconds"
                type="number"
                inputMode="numeric"
                min={5}
                max={300}
                value={hiitWorkSeconds}
                onChange={(e) => setHiitWorkSeconds(Math.max(5, Math.min(300, Number(e.target.value))))}
                className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
              />
              <span className="text-sm text-card-light-muted">sec, rest</span>
              <input
                id="hiit-rest-seconds"
                type="number"
                inputMode="numeric"
                min={0}
                max={300}
                value={hiitRestSeconds}
                onChange={(e) => setHiitRestSeconds(Math.max(0, Math.min(300, Number(e.target.value))))}
                className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
              />
              <span className="text-sm text-card-light-muted">sec, between exercises</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="hiit-rounds" className="text-sm text-card-light-muted">
                Complete
              </label>
              <input
                id="hiit-rounds"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={hiitRounds}
                onChange={(e) => setHiitRounds(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
              />
              <span className="text-sm text-card-light-muted">rounds, resting</span>
              <input
                id="hiit-rest-between-rounds"
                type="number"
                inputMode="numeric"
                min={0}
                max={300}
                value={hiitRestBetweenRoundsSeconds}
                onChange={(e) => setHiitRestBetweenRoundsSeconds(Math.max(0, Math.min(300, Number(e.target.value))))}
                className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
              />
              <span className="text-sm text-card-light-muted">sec between rounds</span>
            </div>
          </>
        )}

        {customLoadError && <p className="text-sm text-danger">{customLoadError}</p>}
        {eligible === null && !customLoadError && <p className="text-sm text-card-light-muted">Loading exercises...</p>}
        {byGroup.map(({ group, exercises }) => (
          <div key={group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">{group.replace("_", " ")}</p>
            <div className="space-y-2">
              {exercises.map((ex) => {
                const selected = customSelection.includes(ex.key);
                return (
                  <div key={ex.key}>
                    <button
                      type="button"
                      disabled={!selected && customSelection.length >= 6}
                      onClick={() => {
                        if (selected) {
                          setCustomSelection((prev) => prev.filter((k) => k !== ex.key));
                          setCustomRests((prev) => {
                            const next = { ...prev };
                            delete next[ex.key];
                            return next;
                          });
                          setCustomAmrapConfig((prev) => {
                            const next = { ...prev };
                            delete next[ex.key];
                            return next;
                          });
                        } else if (customSelection.length < 6) {
                          setCustomSelection((prev) => [...prev, ex.key]);
                          setCustomRests((prev) => ({ ...prev, [ex.key]: DEFAULT_REST_SECONDS }));
                          setCustomAmrapConfig((prev) => ({ ...prev, [ex.key]: amrapConfigFor(ex.key) }));
                        }
                      }}
                      className={`block w-full rounded-lg border px-4 py-3 text-left text-sm font-medium disabled:opacity-50 ${
                        selected
                          ? "border-card-light-foreground bg-card-light-foreground text-white"
                          : "border-card-light-border text-card-light-foreground hover:bg-card-border/10"
                      }`}
                    >
                      {ex.name}
                    </button>
                    {selected && customFormat === "straight_sets" && (
                      <div className="mt-1.5 flex items-center gap-2 pl-1">
                        <label htmlFor={`rest-${ex.key}`} className="text-xs text-card-light-muted">
                          Rest between sets
                        </label>
                        <input
                          id={`rest-${ex.key}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={600}
                          step={15}
                          value={customRests[ex.key] ?? DEFAULT_REST_SECONDS}
                          onChange={(e) => setCustomRests((prev) => ({ ...prev, [ex.key]: Math.max(0, Math.min(600, Number(e.target.value))) }))}
                          className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-xs text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
                        />
                        <span className="text-xs text-card-light-muted">sec</span>
                      </div>
                    )}
                    {selected && customFormat === "amrap" && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-1">
                        <button
                          type="button"
                          onClick={() => setCustomAmrapConfig((prev) => ({ ...prev, [ex.key]: { ...amrapConfigFor(ex.key), unit: "reps" } }))}
                          className={`rounded-md border px-2 py-1 text-xs font-medium ${
                            amrapConfigFor(ex.key).unit === "reps" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border text-card-light-muted"
                          }`}
                        >
                          Reps
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomAmrapConfig((prev) => ({ ...prev, [ex.key]: { ...amrapConfigFor(ex.key), unit: "duration" } }))}
                          className={`rounded-md border px-2 py-1 text-xs font-medium ${
                            amrapConfigFor(ex.key).unit === "duration" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border text-card-light-muted"
                          }`}
                        >
                          Duration
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={amrapConfigFor(ex.key).value}
                          onChange={(e) =>
                            setCustomAmrapConfig((prev) => ({ ...prev, [ex.key]: { ...amrapConfigFor(ex.key), value: Math.max(1, Number(e.target.value)) } }))
                          }
                          className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-xs text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
                        />
                        <span className="text-xs text-card-light-muted">{amrapConfigFor(ex.key).unit === "reps" ? "reps" : "sec"}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          placeholder="kg (optional)"
                          value={amrapConfigFor(ex.key).weightKg}
                          onChange={(e) =>
                            setCustomAmrapConfig((prev) => ({
                              ...prev,
                              [ex.key]: { ...amrapConfigFor(ex.key), weightKg: e.target.value === "" ? "" : Number(e.target.value) },
                            }))
                          }
                          className="w-24 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-xs text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
                        />
                      </div>
                    )}
                    {/* RFT is reps-only (real RFT WODs never prescribe a timed
                        hold) — no Reps/Duration toggle, just a rep count. */}
                    {selected && customFormat === "rounds_for_time" && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={amrapConfigFor(ex.key).value}
                          onChange={(e) =>
                            setCustomAmrapConfig((prev) => ({
                              ...prev,
                              [ex.key]: { unit: "reps", value: Math.max(1, Number(e.target.value)), weightKg: amrapConfigFor(ex.key).weightKg },
                            }))
                          }
                          className="w-16 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-xs text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
                        />
                        <span className="text-xs text-card-light-muted">reps</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          placeholder="kg (optional)"
                          value={amrapConfigFor(ex.key).weightKg}
                          onChange={(e) =>
                            setCustomAmrapConfig((prev) => ({
                              ...prev,
                              [ex.key]: { unit: "reps", value: amrapConfigFor(ex.key).value, weightKg: e.target.value === "" ? "" : Number(e.target.value) },
                            }))
                          }
                          className="w-24 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-xs text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={customSelection.length === 0}
          className={buttonClass}
          onClick={() => {
            // Shared between both Cardio sub-modes — identical per-exercise
            // shape, only the session-level prescription (timeCapSeconds vs
            // targetRounds) differs.
            const circuitExercises = customSelection.map((key) => {
              const cfg = amrapConfigFor(key);
              return {
                key,
                reps: cfg.unit === "reps" ? cfg.value : undefined,
                durationSeconds: cfg.unit === "duration" ? cfg.value : undefined,
                weightKg: cfg.weightKg === "" ? undefined : cfg.weightKg,
              };
            });
            changeMode(
              customFormat === "straight_sets"
                ? { mode: "custom", customExerciseKeys: customSelection, customExerciseRests: customRests }
                : customFormat === "amrap"
                  ? { mode: "custom-amrap", timeCapSeconds: amrapTimeCapMinutes * 60, amrapExercises: circuitExercises }
                  : customFormat === "rounds_for_time"
                    ? {
                        mode: "custom-rft",
                        targetRounds: rftTargetRounds,
                        timeCapSeconds: rftTimeCapMinutes * 60,
                        amrapExercises: circuitExercises.map(({ key, reps, weightKg }) => ({ key, reps, weightKg })),
                      }
                    : {
                        // HIIT carries no per-exercise config at all — just
                        // the picked keys, timing is uniform (see
                        // GenerateChoice's own comment).
                        mode: "custom-hiit",
                        workSeconds: hiitWorkSeconds,
                        restSeconds: hiitRestSeconds,
                        targetRounds: hiitRounds,
                        restBetweenRoundsSeconds: hiitRestBetweenRoundsSeconds,
                        hiitExerciseKeys: customSelection,
                      }
            );
          }}
        >
          Generate workout ({customSelection.length}/6) →
        </button>
        <button
          type="button"
          onClick={() => {
            setCustomSelection([]);
            setCustomRests({});
            setCustomAmrapConfig({});
            setCustomFormat("straight_sets");
            setRftTargetRounds(4);
            setRftTimeCapMinutes(12);
            setHiitWorkSeconds(30);
            setHiitRestSeconds(15);
            setHiitRounds(4);
            setHiitRestBetweenRoundsSeconds(30);
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

  // AMRAP overview (Stage 2, 2026-08-29) — completely different shape
  // from the straight-sets overview below: no sets to preview, no
  // warm-up/cool-down toggles, no swap (exercises are fixed once
  // generated), just the round's exercise list and the time cap, then
  // straight into the timer. detail.status stays "generated" until
  // completeAmrapSession runs, so a member re-opening a finished AMRAP
  // session before that (shouldn't normally happen — summary is the exit
  // point) would see this again rather than being stuck; not worth a
  // special-cased "already done" screen for an edge case that thin.
  if (phase === "overview" && detail.format === "amrap") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">AMRAP — {Math.round((detail.timeCapSeconds ?? 0) / 60)} minutes</p>
        <p className="text-sm text-card-light-muted">As many rounds as possible. Cycle through every exercise below, then repeat.</p>
        <PainCautionBanner detail={detail} allowSwap={false} />
        <ul className="space-y-2">
          {detail.exercises.map((ex, i) => {
            const set = ex.sets[0];
            return (
              <li key={ex.id} className="rounded-lg border border-card-light-border p-3">
                <p className="text-sm font-semibold">
                  {i + 1}. {ex.name}
                </p>
                <p className="text-xs text-card-light-muted">
                  {set?.durationSeconds !== null && set?.durationSeconds !== undefined ? `${set.durationSeconds}s` : `${set?.repsTarget ?? "—"} reps`}
                  {set?.weightTargetKg ? ` @ ${set.weightTargetKg}kg` : ""}
                </p>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setAmrapSecondsRemaining(detail.timeCapSeconds ?? 0);
            setPhase("amrap-active");
          }}
        >
          Start AMRAP →
        </button>
      </div>
    );
  }

  // Rounds-For-Time overview (Stage 3, 2026-08-30; corrected same day —
  // real RFT WODs always carry a time cap) — same shape as AMRAP's above
  // (no sets to preview, no warm-up/cool-down toggles, no swap), but
  // shows the round target AND the time cap, and "Start" resets the
  // stopwatch to zero and seeds rftCapSeconds from the session's own
  // timeCapSeconds.
  if (phase === "overview" && detail.format === "rounds_for_time") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">{detail.targetRounds} Rounds For Time</p>
        <p className="text-sm text-card-light-muted">
          Complete every exercise below, {detail.targetRounds} times through, as fast as you can. Time cap:{" "}
          {Math.round((detail.timeCapSeconds ?? 0) / 60)} minutes.
        </p>
        <PainCautionBanner detail={detail} allowSwap={false} />
        <ul className="space-y-2">
          {detail.exercises.map((ex, i) => {
            const set = ex.sets[0];
            return (
              <li key={ex.id} className="rounded-lg border border-card-light-border p-3">
                <p className="text-sm font-semibold">
                  {i + 1}. {ex.name}
                </p>
                <p className="text-xs text-card-light-muted">
                  {set?.repsTarget ?? "—"} reps
                  {set?.weightTargetKg ? ` @ ${set.weightTargetKg}kg` : ""}
                </p>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setRftSecondsElapsed(0);
            setRftCapSeconds(detail.timeCapSeconds ?? 0);
            setPhase("rft-active");
          }}
        >
          Start →
        </button>
      </div>
    );
  }

  // HIIT overview (Stage 4, 2026-08-30) — same shape as AMRAP/RFT's above
  // (no sets to preview, no warm-up/cool-down toggles, no swap), but
  // shows the interval prescription instead of a time cap or round
  // target alone. "Start" seeds the sequencer at round 1, exercise 0,
  // work sub-phase, counting down from the session's own workSeconds.
  if (phase === "overview" && detail.format === "hiit") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <p className="text-lg font-semibold">
          Work {detail.workSeconds}s / Rest {detail.restSeconds}s × {detail.targetRounds} rounds
        </p>
        <p className="text-sm text-card-light-muted">
          Cycle through every exercise below, resting {detail.restSeconds}s between each. Rest {detail.restBetweenRoundsSeconds}s between rounds.
        </p>
        <PainCautionBanner detail={detail} allowSwap={false} />
        <ul className="space-y-2">
          {detail.exercises.map((ex, i) => (
            <li key={ex.id} className="rounded-lg border border-card-light-border p-3">
              <p className="text-sm font-semibold">
                {i + 1}. {ex.name}
              </p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            // Seed the sequencer's own timing state from the session's
            // real stored prescription, not whatever the builder's local
            // state happens to hold — those only match when the builder
            // was used in this exact page load; resuming an
            // already-generated session on a fresh mount would otherwise
            // silently run the useState defaults (30/15/4/30) instead of
            // what was actually generated.
            setHiitWorkSeconds(detail.workSeconds ?? 30);
            setHiitRestSeconds(detail.restSeconds ?? 0);
            setHiitRounds(detail.targetRounds ?? 1);
            setHiitRestBetweenRoundsSeconds(detail.restBetweenRoundsSeconds ?? 0);
            setHiitCurrentRound(1);
            setHiitCurrentExerciseIndex(0);
            setHiitSubPhase("work");
            setHiitSecondsRemaining(detail.workSeconds ?? 0);
            setPhase("hiit-active");
          }}
        >
          Start →
        </button>
      </div>
    );
  }

  if (phase === "amrap-active" && detail.format === "amrap") {
    const minutes = Math.floor(amrapSecondsRemaining / 60);
    const seconds = amrapSecondsRemaining % 60;
    return (
      <div className="space-y-5 text-center">
        <ExitLink />
        <p className="text-lg font-semibold">Go!</p>
        <p className="text-5xl font-bold tabular-nums">
          {minutes}:{String(seconds).padStart(2, "0")}
        </p>
        <ul className="space-y-2 text-left">
          {detail.exercises.map((ex, i) => {
            const set = ex.sets[0];
            return (
              <li key={ex.id} className="rounded-lg border border-card-light-border p-3">
                <p className="text-sm font-semibold">
                  {i + 1}. {ex.name}
                </p>
                <p className="text-xs text-card-light-muted">
                  {set?.durationSeconds !== null && set?.durationSeconds !== undefined ? `${set.durationSeconds}s` : `${set?.repsTarget ?? "—"} reps`}
                  {set?.weightTargetKg ? ` @ ${set.weightTargetKg}kg` : ""}
                </p>
              </li>
            );
          })}
        </ul>
        <button type="button" className={buttonClass} onClick={() => setPhase("amrap-tally")}>
          Finish now →
        </button>
      </div>
    );
  }

  // Rounds-For-Time active phase (Stage 3, 2026-08-30; corrected same day
  // — real RFT WODs carry a time cap) — a stopwatch counting UP, the
  // visible "how long" tracker. Two ways out: "Finished!" before the cap
  // (round count is already known — the prescription — so nothing to
  // self-report, submits straight to /complete-rft), or the cap-check
  // effect above auto-transitions to "rft-tally" once rftSecondsElapsed
  // reaches rftCapSeconds (a genuine DNF — how far the member got is NOT
  // known in advance, same self-report need as AMRAP's own tally).
  if (phase === "rft-active" && detail.format === "rounds_for_time") {
    const minutes = Math.floor(rftSecondsElapsed / 60);
    const seconds = rftSecondsElapsed % 60;
    const capMinutes = Math.floor(rftCapSeconds / 60);
    const capSecs = rftCapSeconds % 60;

    async function submitRft() {
      setRftSubmitting(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/member/workout/${detail!.sessionId}/complete-rft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elapsedSeconds: rftSecondsElapsed, roundsCompleted: detail!.targetRounds }),
        });
        const body = await res.json();
        if (body.status !== "ok") {
          setErrorMessage(body.message ?? "Couldn't save that. Try again.");
          return;
        }
        setRftRoundsCompleted(detail!.targetRounds!);
        setPhase("summary");
      } catch {
        setErrorMessage("Couldn't save that. Try again.");
      } finally {
        setRftSubmitting(false);
      }
    }

    return (
      <div className="space-y-5 text-center">
        <ExitLink />
        <p className="text-lg font-semibold">Go!</p>
        <p className="text-5xl font-bold tabular-nums">
          {minutes}:{String(seconds).padStart(2, "0")}
        </p>
        <p className="text-xs text-card-light-muted">
          Cap: {capMinutes}:{String(capSecs).padStart(2, "0")}
        </p>
        <ul className="space-y-2 text-left">
          {detail.exercises.map((ex, i) => {
            const set = ex.sets[0];
            return (
              <li key={ex.id} className="rounded-lg border border-card-light-border p-3">
                <p className="text-sm font-semibold">
                  {i + 1}. {ex.name}
                </p>
                <p className="text-xs text-card-light-muted">
                  {set?.repsTarget ?? "—"} reps
                  {set?.weightTargetKg ? ` @ ${set.weightTargetKg}kg` : ""}
                </p>
              </li>
            );
          })}
        </ul>
        {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
        <button type="button" disabled={rftSubmitting} className={buttonClass} onClick={submitRft}>
          {rftSubmitting ? "Saving..." : "Finished! →"}
        </button>
      </div>
    );
  }

  // HIIT active phase (Stage 4, 2026-08-30) — fully automatic, no
  // buttons: the sequencer effect above owns every transition, including
  // the terminal one (submits completion itself and moves to
  // "hiit-tally"). Matches the v1 no-early-exit scope decision — nothing
  // here for the member to tap besides watching the countdown.
  if (phase === "hiit-active" && detail.format === "hiit") {
    const minutes = Math.floor(hiitSecondsRemaining / 60);
    const seconds = hiitSecondsRemaining % 60;
    const currentExercise = detail.exercises[hiitCurrentExerciseIndex];
    const subPhaseLabel = hiitSubPhase === "work" ? "Work" : hiitSubPhase === "rest" ? "Rest" : "Rest before next round";
    return (
      <div className="space-y-5 text-center">
        <ExitLink />
        <p className="text-lg font-semibold">{subPhaseLabel}</p>
        <p className="text-5xl font-bold tabular-nums">
          {minutes}:{String(seconds).padStart(2, "0")}
        </p>
        <p className="text-sm text-card-light-muted">
          Round {hiitCurrentRound} of {hiitRounds}
        </p>
        {currentExercise && <p className="text-base font-semibold">{currentExercise.name}</p>}
        <ul className="space-y-2 text-left">
          {detail.exercises.map((ex, i) => (
            <li
              key={ex.id}
              className={`rounded-lg border p-3 ${
                i === hiitCurrentExerciseIndex ? "border-card-light-foreground bg-card-light-foreground/5" : "border-card-light-border"
              }`}
            >
              <p className="text-sm font-semibold">
                {i + 1}. {ex.name}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // HIIT reps tally (2026-08-30, Carl's own follow-up) — reached
  // automatically once the sequencer finishes; completion already
  // happened (completeHiitSession ran in the terminal transition above).
  // Every field is optional — "Save" only submits exercises the member
  // actually filled in, "Skip" submits nothing and moves on regardless.
  // One number per exercise (not per round) — a member's own rough
  // recollection, same single-post-hoc-estimate posture as AMRAP's tally
  // or an RPE rating, not a live per-round count.
  if (phase === "hiit-tally" && detail.format === "hiit") {
    async function submitHiitTally() {
      setHiitTallySubmitting(true);
      const reps = detail!.exercises
        .filter((ex) => hiitRepsInput[ex.id]?.trim() !== "" && hiitRepsInput[ex.id] !== undefined)
        .map((ex) => ({ exerciseId: ex.id, reps: Number(hiitRepsInput[ex.id]) }));
      try {
        if (reps.length > 0) {
          await fetch(`/api/member/workout/${detail!.sessionId}/log-hiit-reps`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reps }),
          });
        }
      } catch {
        // Logging reps is a nice-to-have — the session itself is already
        // completed regardless.
      } finally {
        setHiitLoggedReps(Object.fromEntries(reps.map((r) => [r.exerciseId, r.reps])));
        setHiitTallySubmitting(false);
        setPhase("summary");
      }
    }

    return (
      <div className="space-y-5">
        <p className="text-lg font-semibold">Nice work! How many reps did you get?</p>
        <p className="text-sm text-card-light-muted">Roughly, per {hiitWorkSeconds}s interval — leave any blank if you&apos;re not sure.</p>
        <ul className="space-y-2">
          {detail.exercises.map((ex) => (
            <li key={ex.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-light-border p-3">
              <p className="text-sm font-semibold">{ex.name}</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="reps"
                value={hiitRepsInput[ex.id] ?? ""}
                onChange={(e) => setHiitRepsInput((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                className="w-20 rounded-md border border-card-light-border bg-white px-2 py-1 text-center text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
              />
            </li>
          ))}
        </ul>
        <button type="button" disabled={hiitTallySubmitting} className={buttonClass} onClick={submitHiitTally}>
          {hiitTallySubmitting ? "Saving..." : "Save →"}
        </button>
        <button
          type="button"
          onClick={() => setPhase("summary")}
          className="block w-full text-center text-xs font-medium text-card-light-muted underline"
        >
          Skip
        </button>
      </div>
    );
  }

  // Rounds-For-Time capped-out tally (Stage 3, 2026-08-30) — reached only
  // via the auto-transition when the stopwatch hits rftCapSeconds. Direct
  // mirror of amrap-tally: how far the member got is genuinely unknown
  // (self-report, same trust posture), but unlike AMRAP there's no
  // reps-vs-duration ambiguity for the partial exercise — RFT is
  // reps-only, so the label is always "reps". elapsedSeconds submitted
  // here is rftCapSeconds itself (the stopwatch is pinned there, not
  // rftSecondsElapsed, though they're equal at this point).
  if (phase === "rft-tally" && detail.format === "rounds_for_time") {
    const partialExercise = rftPartialIndex === "" ? null : detail.exercises[rftPartialIndex];

    async function submitRftTally() {
      if (rftRoundsCompleted === "") return;
      setRftSubmitting(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/member/workout/${detail!.sessionId}/complete-rft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            elapsedSeconds: rftCapSeconds,
            roundsCompleted: rftRoundsCompleted,
            partialRoundExerciseIndex: rftPartialIndex === "" ? undefined : rftPartialIndex,
            partialRoundReps: rftPartialIndex === "" ? undefined : (rftPartialReps === "" ? 0 : rftPartialReps),
          }),
        });
        const body = await res.json();
        if (body.status !== "ok") {
          setErrorMessage(body.message ?? "Couldn't save that. Try again.");
          return;
        }
        setPhase("summary");
      } catch {
        setErrorMessage("Couldn't save that. Try again.");
      } finally {
        setRftSubmitting(false);
      }
    }

    return (
      <div className="space-y-5">
        <p className="text-lg font-semibold">Time cap reached — how far did you get?</p>
        <div>
          <label htmlFor="rft-rounds-completed" className="mb-1.5 block text-xs text-card-light-muted">
            Full rounds completed
          </label>
          <input
            id="rft-rounds-completed"
            type="number"
            inputMode="numeric"
            min={0}
            max={detail.targetRounds ?? 20}
            className={inputClass}
            value={rftRoundsCompleted}
            onChange={(e) => setRftRoundsCompleted(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div>
          <label htmlFor="rft-partial-exercise" className="mb-1.5 block text-xs text-card-light-muted">
            Then got through to (optional — leave blank if you finished exactly on a round)
          </label>
          <select
            id="rft-partial-exercise"
            value={rftPartialIndex}
            onChange={(e) => setRftPartialIndex(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
          >
            <option value="">— Finished exactly on a round —</option>
            {detail.exercises.map((ex, i) => (
              <option key={ex.id} value={i}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
        {rftPartialIndex !== "" && (
          <div>
            <label htmlFor="rft-partial-reps" className="mb-1.5 block text-xs text-card-light-muted">
              How many reps of that one, {partialExercise?.name}
            </label>
            <input
              id="rft-partial-reps"
              type="number"
              inputMode="numeric"
              min={0}
              className={inputClass}
              value={rftPartialReps}
              onChange={(e) => setRftPartialReps(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            />
          </div>
        )}
        {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
        <button type="button" disabled={rftSubmitting || rftRoundsCompleted === ""} className={buttonClass} onClick={submitRftTally}>
          {rftSubmitting ? "Saving..." : "Done →"}
        </button>
      </div>
    );
  }

  if (phase === "amrap-tally" && detail.format === "amrap") {
    const partialExercise = amrapPartialIndex === "" ? null : detail.exercises[amrapPartialIndex];
    const partialUnit = partialExercise?.sets[0]?.durationSeconds != null ? "seconds" : "reps";

    async function submitAmrapTally() {
      if (amrapRoundsCompleted === "") return;
      setAmrapSubmitting(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/member/workout/${detail!.sessionId}/complete-amrap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundsCompleted: amrapRoundsCompleted,
            partialRoundExerciseIndex: amrapPartialIndex === "" ? undefined : amrapPartialIndex,
            partialRoundReps: amrapPartialIndex === "" ? undefined : (amrapPartialReps === "" ? 0 : amrapPartialReps),
          }),
        });
        const body = await res.json();
        if (body.status !== "ok") {
          setErrorMessage(body.message ?? "Couldn't save that. Try again.");
          return;
        }
        setPhase("summary");
      } catch {
        setErrorMessage("Couldn't save that. Try again.");
      } finally {
        setAmrapSubmitting(false);
      }
    }

    return (
      <div className="space-y-5">
        <p className="text-lg font-semibold">Time&apos;s up — how far did you get?</p>
        <div>
          <label htmlFor="rounds-completed" className="mb-1.5 block text-xs text-card-light-muted">
            Full rounds completed
          </label>
          <input
            id="rounds-completed"
            type="number"
            inputMode="numeric"
            min={0}
            className={inputClass}
            value={amrapRoundsCompleted}
            onChange={(e) => setAmrapRoundsCompleted(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div>
          <label htmlFor="partial-exercise" className="mb-1.5 block text-xs text-card-light-muted">
            Then got through to (optional — leave blank if you finished exactly on a round)
          </label>
          <select
            id="partial-exercise"
            value={amrapPartialIndex}
            onChange={(e) => setAmrapPartialIndex(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
          >
            <option value="">— Finished exactly on a round —</option>
            {detail.exercises.map((ex, i) => (
              <option key={ex.id} value={i}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
        {amrapPartialIndex !== "" && (
          <div>
            <label htmlFor="partial-reps" className="mb-1.5 block text-xs text-card-light-muted">
              How many {partialUnit} of that one
            </label>
            <input
              id="partial-reps"
              type="number"
              inputMode="numeric"
              min={0}
              className={inputClass}
              value={amrapPartialReps}
              onChange={(e) => setAmrapPartialReps(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
            />
          </div>
        )}
        {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
        <button type="button" disabled={amrapSubmitting || amrapRoundsCompleted === ""} className={buttonClass} onClick={submitAmrapTally}>
          {amrapSubmitting ? "Saving..." : "Done →"}
        </button>
      </div>
    );
  }

  const hasProgress = hasAnyProgress(detail);

  if (phase === "overview") {
    return (
      <div className="space-y-5">
        <ExitLink />
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold">{hasProgress ? "Continue today's session" : "Today's session"}</p>
          {!hasProgress && (
            <button type="button" onClick={() => setPhase("change-warning")} className="text-xs font-medium text-card-light-muted underline">
              Change today&apos;s workout
            </button>
          )}
        </div>

        <PainCautionBanner detail={detail} allowSwap={true} />

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

        <div className="space-y-3">
          <div className="rounded-lg border border-card-light-border">
            <button
              type="button"
              onClick={() => setExpandedSections((s) => ({ ...s, warmup: !s.warmup }))}
              className="relative flex w-full items-center justify-center p-4 text-center"
            >
              <div>
                <p className="text-base font-semibold text-card-light-foreground">Warm-up</p>
                <p className="text-sm text-card-light-muted">2-5 min — cardio &amp; mobility</p>
              </div>
              <span className="absolute right-4 text-lg text-card-light-foreground">{expandedSections.warmup ? "−" : "+"}</span>
            </button>
            {expandedSections.warmup && (
              <div className="space-y-3 border-t border-card-light-border p-4">
                <ul className="space-y-2">
                  {WARMUP_ITEMS.map((item) => (
                    <li key={item.key} className="text-sm">
                      <span className="font-medium">{item.name}</span>{" "}
                      <span className="text-card-light-muted">— {item.instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-card-light-border">
            <button
              type="button"
              onClick={() => setExpandedSections((s) => ({ ...s, main: !s.main }))}
              className="relative flex w-full items-center justify-center p-4 text-center"
            >
              <div>
                <p className="text-base font-semibold text-card-light-foreground">Main workout</p>
                <p className="text-sm text-card-light-muted">{detail.exercises.length} exercises</p>
              </div>
              <span className="absolute right-4 text-lg text-card-light-foreground">{expandedSections.main ? "−" : "+"}</span>
            </button>
            {expandedSections.main && (
              <ul className="space-y-3 border-t border-card-light-border p-4">
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
            )}
          </div>

          <div className="rounded-lg border border-card-light-border">
            <button
              type="button"
              onClick={() => setExpandedSections((s) => ({ ...s, cooldown: !s.cooldown }))}
              className="relative flex w-full items-center justify-center p-4 text-center"
            >
              <div>
                <p className="text-base font-semibold text-card-light-foreground">Static stretching</p>
                <p className="text-sm text-card-light-muted">Cool down and stretch</p>
              </div>
              <span className="absolute right-4 text-lg text-card-light-foreground">{expandedSections.cooldown ? "−" : "+"}</span>
            </button>
            {expandedSections.cooldown && (
              <div className="space-y-3 border-t border-card-light-border p-4">
                <ul className="space-y-2">
                  {COOLDOWN_ITEMS.map((item) => (
                    <li key={item.key} className="text-sm">
                      <span className="font-medium">{item.name}</span>{" "}
                      <span className="text-card-light-muted">— {item.instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

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
            setWarmupItemIndex(0);
            setPhase(hasProgress ? "active" : "warmup");
          }}
        >
          {hasProgress ? "Resume workout →" : "Start workout →"}
        </button>
      </div>
    );
  }

  if (phase === "warmup") {
    const item = WARMUP_ITEMS[warmupItemIndex];
    const isLastWarmupItem = warmupItemIndex === WARMUP_ITEMS.length - 1;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <ExitLink />
          <button
            type="button"
            onClick={() => setPhase("active")}
            className="text-xs font-medium text-card-light-muted underline"
          >
            Skip warm-up
          </button>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
            {warmupItemIndex + 1} of {WARMUP_ITEMS.length}
          </p>
          <p className="mt-1 text-lg font-semibold">{item.name}</p>
          <p className="text-sm text-card-light-muted">{item.instruction}</p>
        </div>
        {exerciseVideoOverrides[item.key] && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-card-light-border">
            <video src={exerciseVideoOverrides[item.key]} controls playsInline className="h-full w-full" />
          </div>
        )}
        <button
          type="button"
          className={buttonClass}
          onClick={() => (isLastWarmupItem ? setPhase("active") : setWarmupItemIndex((i) => i + 1))}
        >
          {isLastWarmupItem ? "Continue to workout →" : "Next →"}
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

  // Lets a member bail out of the main workout early (Carl's "skip
  // section" request, 2026-09-06) — jumps straight to whichever section
  // would normally follow the very last set, same branch applyAdvance's
  // own end-of-workout case already takes.
  function skipMainWorkout() {
    setCooldownItemIndex(0);
    setPhase("cooldown");
  }

  function applyAdvance() {
    if (isLastSetOfExercise) {
      if (isLastExercise) {
        setCooldownItemIndex(0);
        setPhase("cooldown");
        return;
      }
      const nextExercise = detail!.exercises[exerciseIndex + 1];
      setExerciseIndex((i) => i + 1);
      setSetIndex(0);
      // Straight-sets exercises (the only ones this "active"/"log set" flow
      // ever runs for) always have a real reps_target — the ?? 0 only
      // exists to satisfy WorkoutSet's now-nullable type (Stage 2's
      // duration-based AMRAP sets), never hit in practice here.
      setReps(nextExercise.sets[0].repsTarget ?? 0);
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
      setReps(nextSet.repsTarget ?? 0);
      // A null target here means every set of this exercise is blank
      // (first time doing it, same exercise) — carry forward whatever
      // was just typed for the previous set rather than making the
      // member re-enter the identical number 2-3 times in a row.
      setWeight(nextSet.weightTargetKg ?? weight);
      setPhase("active");
    }
  }
  // "Latest ref" pattern — applyAdvance can only be defined here, after
  // detail/exercise/etc. are known (this whole block is unreachable on
  // the `if (!detail) return null` renders above), but the rest-timer
  // effect that needs to call it lives in the early-hooks block near the
  // top of this component, which can never conditionally skip a hook
  // call. A ref is the standard bridge between the two.
  // eslint-disable-next-line react-hooks/refs -- deliberate latest-ref sync, not a stray render-time mutation
  applyAdvanceRef.current = applyAdvance;

  // Rests between sets when the current exercise carries a member-set
  // restSeconds (custom workouts, Stage 1, 2026-08-29) — skipped entirely
  // for every default/focus exercise and any custom pick left at the
  // builder's default (same instant-advance as before this existed), and
  // skipped on the very last set of the whole session (nothing left to
  // rest before — straight to cooldown/summary). The countdown itself
  // lives in the early-hooks block above (applyAdvanceRef.current), since
  // a hook can't be declared this far down past a conditional return.
  function advance() {
    const isVeryLastSet = isLastSetOfExercise && isLastExercise;
    if (exercise.restSeconds && !isVeryLastSet) {
      setRestSecondsRemaining(exercise.restSeconds);
      setPhase("resting");
      return;
    }
    applyAdvance();
  }

  if (phase === "resting") {
    // The upcoming set belongs to the same exercise unless this rest
    // follows that exercise's last set, in which case the next one starts
    // a different exercise — mirrors applyAdvance's own branching exactly.
    const nextExerciseName = isLastSetOfExercise ? detail.exercises[exerciseIndex + 1]?.name : exercise.name;
    return (
      <div className="space-y-5 text-center">
        <ExitLink />
        <p className="text-lg font-semibold">Rest</p>
        <p className="text-5xl font-bold tabular-nums">{restSecondsRemaining}s</p>
        {nextExerciseName && <p className="text-sm text-card-light-muted">Next: {nextExerciseName}</p>}
        <button type="button" className={buttonClass} onClick={applyAdvance}>
          Skip rest →
        </button>
      </div>
    );
  }

  if (phase === "cooldown") {
    const item = COOLDOWN_ITEMS[cooldownItemIndex];
    const isLastCooldownItem = cooldownItemIndex === COOLDOWN_ITEMS.length - 1;
    return (
      <div className="space-y-5">
        <ExitLink />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
            {cooldownItemIndex + 1} of {COOLDOWN_ITEMS.length}
          </p>
          <p className="mt-1 text-lg font-semibold">{item.name}</p>
          <p className="text-sm text-card-light-muted">{item.instruction}</p>
        </div>
        {exerciseVideoOverrides[item.key] && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-card-light-border">
            <video src={exerciseVideoOverrides[item.key]} controls playsInline className="h-full w-full" />
          </div>
        )}
        <button
          type="button"
          className={buttonClass}
          onClick={() => (isLastCooldownItem ? finishSession() : setCooldownItemIndex((i) => i + 1))}
        >
          {isLastCooldownItem ? "Finish →" : "Next →"}
        </button>
      </div>
    );
  }

  // Two real outcomes (corrected 2026-08-30 — real RFT WODs have a time
  // cap, so "capped" is a genuine possibility): capped === rftSecondsElapsed
  // reaching rftCapSeconds exactly (the stopwatch's cap-check effect stops
  // ticking there, so this is a reliable derived signal, no extra state
  // needed) means the tally screen's self-reported partial result; anything
  // less means a real finish, always reporting the full targetRounds.
  if (phase === "summary" && detail.format === "rounds_for_time") {
    const capped = rftSecondsElapsed >= rftCapSeconds;
    const minutes = Math.floor(rftSecondsElapsed / 60);
    const seconds = rftSecondsElapsed % 60;
    const partialExercise = rftPartialIndex === "" ? null : detail.exercises[rftPartialIndex];
    return (
      <div className="space-y-5 text-center">
        <p className="text-xl font-semibold">{capped ? "Time cap reached" : "Rounds For Time complete!"}</p>
        <p className="text-sm text-card-light-muted">
          {rftRoundsCompleted} round{rftRoundsCompleted === 1 ? "" : "s"}
          {capped && partialExercise && `, then ${rftPartialReps} reps of ${partialExercise.name}`}
          {" in "}
          {minutes}:{String(seconds).padStart(2, "0")}
          {capped ? " (time cap)" : ""}
        </p>
        <Link href="/" className={`${buttonClass} block`}>
          Back to Home
        </Link>
      </div>
    );
  }

  // HIIT summary (Stage 4, 2026-08-30) — nothing self-reported, unlike
  // AMRAP/RFT's summaries above: v1 always completes every prescribed
  // round, so the total time is fully derivable from local state (same
  // formula completeHiitSession computes server-side) rather than
  // anything read back from a fresh fetch — same "read local state, not
  // detail" pattern the AMRAP/RFT summaries above already follow.
  if (phase === "summary" && detail.format === "hiit") {
    const n = detail.exercises.length;
    const totalSeconds = hiitRounds * (n * hiitWorkSeconds + Math.max(n - 1, 0) * hiitRestSeconds) + Math.max(hiitRounds - 1, 0) * hiitRestBetweenRoundsSeconds;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return (
      <div className="space-y-5 text-center">
        <p className="text-xl font-semibold">HIIT complete!</p>
        <p className="text-sm text-card-light-muted">
          {hiitRounds} round{hiitRounds === 1 ? "" : "s"} in {minutes}:{String(seconds).padStart(2, "0")}
        </p>
        {Object.keys(hiitLoggedReps).length > 0 && (
          <ul className="space-y-1 text-left text-sm text-card-light-muted">
            {detail.exercises
              .filter((ex) => hiitLoggedReps[ex.id] !== undefined)
              .map((ex) => (
                <li key={ex.id}>
                  {ex.name}: {hiitLoggedReps[ex.id]} reps
                </li>
              ))}
          </ul>
        )}
        <Link href="/" className={`${buttonClass} block`}>
          Back to Home
        </Link>
      </div>
    );
  }

  if (phase === "summary" && detail.format === "amrap") {
    const roundsLabel = `${amrapRoundsCompleted} round${amrapRoundsCompleted === 1 ? "" : "s"}`;
    const partialExercise = amrapPartialIndex === "" ? null : detail.exercises[amrapPartialIndex];
    return (
      <div className="space-y-5 text-center">
        <p className="text-xl font-semibold">AMRAP complete!</p>
        <p className="text-sm text-card-light-muted">
          {roundsLabel}
          {partialExercise && `, then ${amrapPartialReps} ${partialExercise.sets[0]?.durationSeconds != null ? "seconds" : "reps"} of ${partialExercise.name}`}
        </p>
        <Link href="/" className={`${buttonClass} block`}>
          Back to Home
        </Link>
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
  const ownVideoUrl = exerciseVideoOverrides[exercise.key];
  const youtubeVideoId = getYoutubeVideoId(exercise.key);
  const youtubeTiming = getYoutubeEmbedTiming(exercise.key);
  const youtubeEmbedParams = new URLSearchParams({ rel: "0" });
  if (youtubeTiming.start !== undefined) youtubeEmbedParams.set("start", String(youtubeTiming.start));
  if (youtubeTiming.end !== undefined) youtubeEmbedParams.set("end", String(youtubeTiming.end));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <ExitLink />
        <button type="button" onClick={skipMainWorkout} className="text-xs font-medium text-card-light-muted underline">
          Skip to stretching →
        </button>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
          Exercise {exerciseIndex + 1} of {detail.exercises.length}
        </p>
        <p className="mt-1 text-xl font-semibold">{exercise.name}</p>
        <p className="text-sm text-card-light-muted">
          Set {setIndex + 1} of {exercise.sets.length}
        </p>
      </div>

      {ownVideoUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-card-light-border">
          {/* Own uploaded clip (see podHq's exercise-videos admin page) — no YouTube branding, no iframe. */}
          <video src={ownVideoUrl} controls playsInline className="h-full w-full" />
        </div>
      ) : youtubeVideoId ? (
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
      {exercise.weightChangeReason && (
        <p className="text-xs text-card-light-muted">
          <span className="font-medium">Why:</span> {exercise.weightChangeReason}
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
