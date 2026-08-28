import type { CheckInState } from "@/lib/coach/checkin-state";
import type { RecoveryStatus } from "@/lib/coach/recovery-status";
import type { WeeklyReview } from "@/lib/coach/weekly-review";

export type WeeklyRecommendation =
  | { kind: "complete_checkin"; habit: string; reason: string }
  | { kind: "hit_sessions"; habit: string; reason: string }
  | { kind: "prioritise_sleep"; habit: string; reason: string }
  | { kind: "member_habit"; habit: string; reason: string }
  | { kind: "log_nutrition"; habit: string; reason: string }
  | { kind: "hit_protein"; habit: string; reason: string }
  | { kind: "on_track"; habit: string; reason: string };

// Which single habit the Coach tab leads with this week (Carl,
// 2026-08-25: "recommendations for this week = 1 habit to work on and
// why"). Pure function over data the caller already has, discriminated
// union, priority order — same shape as recovery-signal.ts/
// checkin-state.ts/training-block-state.ts. Hardcoded copy, not
// LLM-generated — same "nothing a member might act on gets left to an
// LLM to improvise" principle as the exercise catalog's safety tips and
// the meal catalog. Checked in priority order and returns the first
// thing that applies; "on_track" is the honest default when nothing
// else is flagged, not a fabricated congratulation.
//
// member_habit (2026-08-28, Carl's own "push you forwards this week"
// check-in question) deliberately sits below prioritise_sleep, not
// above it: a live recovery signal from this week's real data must
// never be silently replaced by a self-statement the member made when
// they checked in, possibly several days ago — same "a real safety
// signal is never suppressed by anything else" principle checkin-state
// and the exercise catalog's injury filtering already hold elsewhere.
// It does outrank the generic log_nutrition/hit_protein nudges below,
// though — a specific thing the member actually committed to is more
// motivating than a generic system-derived reminder.
export function getWeeklyRecommendation(
  checkInState: CheckInState,
  sessionsCompleted: number,
  sessionsTarget: number,
  recoveryStatus: RecoveryStatus,
  weeklyReview: WeeklyReview,
  memberHabit: string | null
): WeeklyRecommendation {
  if (checkInState.kind === "overdue" || checkInState.kind === "due") {
    return {
      kind: "complete_checkin",
      habit: "Complete your weekly check-in",
      reason: "It only takes a minute, and it's what keeps your plan actually tailored to how your week's gone.",
    };
  }

  if (sessionsCompleted < sessionsTarget) {
    return {
      kind: "hit_sessions",
      habit: "Hit your session target this week",
      reason: `You've completed ${sessionsCompleted} of ${sessionsTarget} sessions so far — consistency moves the needle more than any single hard session does.`,
    };
  }

  if (recoveryStatus.kind === "low_recovery") {
    const reasonDetail =
      recoveryStatus.reason === "elevated_resting_hr"
        ? "Your resting heart rate has been elevated"
        : "Your sleep has been below your recent average";
    return {
      kind: "prioritise_sleep",
      habit: "Prioritise sleep this week",
      reason: `${reasonDetail} — recovery is when the training actually pays off.`,
    };
  }

  if (memberHabit !== null) {
    return {
      kind: "member_habit",
      habit: memberHabit,
      reason: "The habit you committed to at your last check-in.",
    };
  }

  if (weeklyReview.nutritionDaysLogged < 4) {
    return {
      kind: "log_nutrition",
      habit: "Log your meals daily",
      reason: `You logged food on ${weeklyReview.nutritionDaysLogged} of the last 7 days — tracking consistently is what makes your targets mean anything.`,
    };
  }

  if (weeklyReview.targets && weeklyReview.avgDailyProteinG !== null && weeklyReview.avgDailyProteinG < weeklyReview.targets.proteinG * 0.8) {
    return {
      kind: "hit_protein",
      habit: "Hit your protein target",
      reason: `You're averaging ${weeklyReview.avgDailyProteinG}g/day against a ${weeklyReview.targets.proteinG}g target — worth closing that gap for recovery and muscle retention.`,
    };
  }

  return {
    kind: "on_track",
    habit: "Keep doing what you're doing",
    reason: "Sessions, nutrition and recovery are all on track this week — nothing to change.",
  };
}
