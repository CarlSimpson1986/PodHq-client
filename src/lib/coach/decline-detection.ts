import { EXERCISE_CATALOG } from "@/lib/coach/exercise-catalog";
import type { ExerciseTrend } from "@/lib/coach/coach-profile";

// Epley formula — the standard estimated-one-rep-max calculation, used here
// because raw weight can't be compared session-to-session in this app: the
// rep target itself shifts across a training block's 4-week phases (see
// REP_TARGET_BY_BLOCK_PHASE in types.ts), so a lower weight at a lower rep
// target isn't decline. e1RM normalizes weight and reps into one comparable
// number. Approved with Carl 2026-09-07.
export function estimateOneRepMax(weightActualKg: number, repsActual: number): number {
  return weightActualKg * (1 + repsActual / 30);
}

// The approved rule (2026-09-07, relaxed once after a Plan agent flagged
// the first draft — strictly falling every step — as too fragile against
// ordinary noise like plate rounding or a slightly different rep count):
//
// e1RM across the lift's last 3 real appearances (trend.appearances is
// already newest-first) must be non-increasing overall, with at least one
// genuine decrease — AND the newest RPE isn't lower than the RPE from 2
// appearances ago.
//
// The RPE check is what distinguishes a member's own deliberate back-off
// (which drops output AND effort together — not concerning) from real
// overreaching (output falls while effort holds or rises) — standard
// RPE/RIR-based autoregulation logic, not this app's own invention.
// Missing RPE is treated as "didn't ease off" — erring toward the harmless
// dismissible banner over missing a real signal.
export function detectDecline(trend: ExerciseTrend): boolean {
  if (trend.appearances.length < 3) return false;
  const [newest, middle, oldest] = trend.appearances;

  const e1rmNewest = estimateOneRepMax(newest.weightActualKg, newest.repsActual);
  const e1rmMiddle = estimateOneRepMax(middle.weightActualKg, middle.repsActual);
  const e1rmOldest = estimateOneRepMax(oldest.weightActualKg, oldest.repsActual);

  const nonIncreasing = e1rmNewest <= e1rmMiddle && e1rmMiddle <= e1rmOldest;
  const genuineDecrease = e1rmNewest < e1rmMiddle || e1rmMiddle < e1rmOldest;
  if (!nonIncreasing || !genuineDecrease) return false;

  const rpeEasedOff = newest.rpe !== null && oldest.rpe !== null && newest.rpe < oldest.rpe;
  return !rpeEasedOff;
}

// Compound lifts only (Carl's own scope call, 2026-09-07) — accessory
// exercises aren't programmed with the same protection a core lift gets,
// so a decline there isn't worth interrupting a session over. Walks the
// plan in its own generation order and returns the first qualifying
// match — a documented v1 simplification if two compounds decline in the
// same session (see podhq-client's ROADMAP.md).
export function findDeclineAlertExerciseKey(plan: { key: string }[], trends: ExerciseTrend[]): string | null {
  const trendByKey = new Map(trends.map((t) => [t.exerciseKey, t]));
  for (const { key } of plan) {
    const catalogEntry = EXERCISE_CATALOG.find((e) => e.key === key);
    if (!catalogEntry?.isCompound) continue;
    const trend = trendByKey.get(key);
    if (trend && detectDecline(trend)) return key;
  }
  return null;
}
