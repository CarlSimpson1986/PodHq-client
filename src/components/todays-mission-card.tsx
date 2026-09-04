"use client";

import { useState } from "react";
import Link from "next/link";
import type { TodaysMission } from "@/lib/coach/todays-mission";
import type { MemberHabit } from "@/lib/coach/daily-habits";
import { DailyHabitsCard } from "@/components/daily-habits-card";
import { ChevronRightIcon } from "@/components/icons";

type Habit = MemberHabit & { todayCount: number };

const rowClass = "flex items-center justify-between gap-3 rounded-lg border border-card-light-border px-3 py-2.5";

function isWorkoutDone(workout: TodaysMission["workout"]): boolean {
  return workout.kind === "completed" || (workout.kind === "no_booking" && workout.manuallyLogged);
}
function isStepsDone(steps: TodaysMission["steps"]): boolean {
  return steps.count !== null && steps.count >= steps.target;
}
function isNutritionDone(nutrition: TodaysMission["nutrition"]): boolean {
  return nutrition.target !== null && nutrition.calories >= nutrition.target * 0.9;
}
function isHabitsDone(habits: TodaysMission["habits"]): boolean {
  return habits.total > 0 && habits.done >= habits.total;
}

function StatusDot({ done }: { done: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs ${
        done ? "border-success bg-success text-white" : "border-card-light-border"
      }`}
    >
      {done ? "✓" : ""}
    </span>
  );
}

function WorkoutRow({ workout }: { workout: TodaysMission["workout"] }) {
  const [manuallyLogged, setManuallyLogged] = useState(workout.kind === "no_booking" ? workout.manuallyLogged : false);
  const [busy, setBusy] = useState(false);

  if (workout.kind === "no_booking") {
    // "I worked out anyway" tick, for a day with no booked session — a
    // booked session's own completion status (below) is the source of
    // truth otherwise, this only ever applies here. Optimistic, same
    // pattern as DailyHabitsCard's tick/untick; reverts on a failed
    // request rather than reconciling against a GET, since the table's
    // one-row-per-day constraint makes true/false the only two states.
    async function toggle() {
      if (busy) return;
      setBusy(true);
      const wasLogged = manuallyLogged;
      setManuallyLogged(!wasLogged);
      try {
        const res = await fetch("/api/member/workout-manual-log", { method: wasLogged ? "DELETE" : "POST" });
        const body = await res.json();
        if (body.status !== "ok") setManuallyLogged(wasLogged);
      } catch {
        setManuallyLogged(wasLogged);
      } finally {
        setBusy(false);
      }
    }

    // Preview link still goes to /training rather than /book — a member
    // should always be able to see what their next workout would be,
    // credit or no credit (Carl's call, 2026-08-29); /training's "Your
    // workouts" section is exactly that preview, generated the same way
    // a real booking would.
    return (
      <div className={rowClass}>
        <button type="button" disabled={busy} onClick={toggle} className="flex items-center gap-2.5 text-left text-sm disabled:opacity-50">
          <StatusDot done={manuallyLogged} />
          Workout
        </button>
        <Link href="/training" prefetch={false} className="text-xs text-card-light-muted hover:underline">
          {manuallyLogged ? "Logged today — preview →" : "No session booked — preview →"}
        </Link>
      </div>
    );
  }
  const done = isWorkoutDone(workout);
  return (
    <Link href={`/workout/${workout.bookingId}`} prefetch={false} className={`${rowClass} hover:bg-card-border/10`}>
      <span className="flex items-center gap-2.5 text-sm">
        <StatusDot done={done} />
        Workout
      </span>
      <span className="text-xs text-card-light-muted">{done ? "Complete" : "Ready →"}</span>
    </Link>
  );
}

function StepsRow({ steps }: { steps: TodaysMission["steps"] }) {
  return (
    <div className={rowClass}>
      <span className="flex items-center gap-2.5 text-sm">
        <StatusDot done={isStepsDone(steps)} />
        Steps
      </span>
      <span className="text-xs text-card-light-muted">
        {steps.count === null ? "No data yet today" : `${steps.count.toLocaleString("en-GB")} / ${steps.target.toLocaleString("en-GB")}`}
      </span>
    </div>
  );
}

function NutritionRow({ nutrition }: { nutrition: TodaysMission["nutrition"] }) {
  return (
    <Link href="/nutrition" prefetch={false} className={`${rowClass} hover:bg-card-border/10`}>
      <span className="flex items-center gap-2.5 text-sm">
        <StatusDot done={isNutritionDone(nutrition)} />
        Nutrition
      </span>
      <span className="text-xs text-card-light-muted">
        {nutrition.target === null ? `${nutrition.calories} kcal logged` : `${nutrition.calories} / ${nutrition.target} kcal`}
      </span>
    </Link>
  );
}

// Home's "Today's Mission" card — premium-only (trial_active/subscriber),
// see src/app/page.tsx. Collapsed by default (Carl's call, 2026-08-29):
// Home already stacks the AI Coach pointer, upcoming session, leaderboard
// and find-a-professional cards, so this stays a one-line "x/5 today"
// summary until tapped open, rather than permanently adding two cards'
// worth of height. Habits render via the same DailyHabitsCard used
// standalone on /coach/profile, just with `embedded` to drop its own card
// chrome since it's already inside this card's expanded body. Cardio
// (2026-08-30) was a 5th row here, same shape as Workout/Nutrition — a
// link out to a separate logging entry point — removed 2026-09-03 (Carl:
// "that's the same as a workout") since it duplicated Workout's job
// rather than covering separate ground. The logging feature itself
// (/cardio-log) is untouched, just no longer surfaced from here.
export function TodaysMissionCard({ mission, initialHabits }: { mission: TodaysMission; initialHabits: Habit[] }) {
  const [expanded, setExpanded] = useState(false);

  const doneCount = [
    isWorkoutDone(mission.workout),
    isStepsDone(mission.steps),
    isNutritionDone(mission.nutrition),
    isHabitsDone(mission.habits),
  ].filter(Boolean).length;

  return (
    <div className="card-light overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Today&apos;s tasks</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold">{doneCount} / 4 today</span>
          <ChevronRightIcon className={`h-4 w-4 flex-none text-card-light-muted transition-transform ${expanded ? "rotate-90" : ""}`} />
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 px-5 pb-5">
          <div className="space-y-2">
            <WorkoutRow workout={mission.workout} />
            <StepsRow steps={mission.steps} />
            <NutritionRow nutrition={mission.nutrition} />
          </div>
          <div className="border-t border-card-light-border pt-4">
            <DailyHabitsCard initialHabits={initialHabits} embedded />
          </div>
        </div>
      )}
    </div>
  );
}
