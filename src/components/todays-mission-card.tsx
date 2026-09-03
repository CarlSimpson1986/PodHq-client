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
  return workout.kind === "completed";
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
function isCardioDone(cardio: TodaysMission["cardio"]): boolean {
  return cardio.done;
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
  if (workout.kind === "no_booking") {
    // Links to /training rather than /book — a member should always be
    // able to see what their next workout would be, credit or no credit
    // (Carl's call, 2026-08-29); /training's "Your workouts" section is
    // exactly that preview, generated the same way a real booking would.
    return (
      <Link href="/training" prefetch={false} className={`${rowClass} hover:bg-card-border/10`}>
        <span className="text-sm">Workout</span>
        <span className="text-xs text-card-light-muted">No session booked — preview →</span>
      </Link>
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

function CardioRow({ cardio }: { cardio: TodaysMission["cardio"] }) {
  const done = isCardioDone(cardio);
  return (
    <Link href="/cardio-log" prefetch={false} className={`${rowClass} hover:bg-card-border/10`}>
      <span className="flex items-center gap-2.5 text-sm">
        <StatusDot done={done} />
        Cardio
      </span>
      <span className="text-xs text-card-light-muted">{done ? "Logged" : "Log a machine →"}</span>
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
// (2026-08-30) is the 5th row, added the same shape as Workout/Nutrition
// — a link out to a separate logging entry point, not an inline action.
export function TodaysMissionCard({ mission, initialHabits }: { mission: TodaysMission; initialHabits: Habit[] }) {
  const [expanded, setExpanded] = useState(false);

  const doneCount = [
    isWorkoutDone(mission.workout),
    isStepsDone(mission.steps),
    isNutritionDone(mission.nutrition),
    isHabitsDone(mission.habits),
    isCardioDone(mission.cardio),
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
          <span className="text-sm font-semibold">{doneCount} / 5 today</span>
          <ChevronRightIcon className={`h-4 w-4 flex-none text-card-light-muted transition-transform ${expanded ? "rotate-90" : ""}`} />
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 px-5 pb-5">
          <div className="space-y-2">
            <WorkoutRow workout={mission.workout} />
            <StepsRow steps={mission.steps} />
            <NutritionRow nutrition={mission.nutrition} />
            <CardioRow cardio={mission.cardio} />
          </div>
          <div className="border-t border-card-light-border pt-4">
            <DailyHabitsCard initialHabits={initialHabits} embedded />
          </div>
        </div>
      )}
    </div>
  );
}
