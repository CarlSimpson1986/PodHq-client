import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getCoachHomeState } from "@/lib/coach/trial-state";
import { getLastCheckIn } from "@/lib/coach/check-ins";
import { getCheckInDueState, currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getRecoveryStatus } from "@/lib/coach/recovery-status";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { getWeeklyConsistency } from "@/lib/coach/consistency";
import { NoMemberProfile } from "@/components/no-member-profile";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { WeekCalendarStrip } from "@/components/week-calendar-strip";
import { RecoveryStatusCard } from "@/components/recovery-status-card";
import { TrialBanner } from "@/components/trial-banner";
import { MoreMenu } from "@/components/more-menu";
import { TrophyIcon } from "@/components/icons";

// The new Dashboard — replaces /coach's old hub content (2026-08-25
// redesign, see ROADMAP.md). Same trial/subscriber gating as before
// (getCoachHomeState): non-premium states still just show their banner,
// the full card set below is only for trial_active/subscriber. Every card
// here reuses an existing data function — see the redesign plan for the
// full inventory of what's real vs. net-new.
//
// Training block card removed 2026-08-28 (Carl) — /training's own
// "Current training block" section (TrainingBlockView) already shows
// the full phase/rep detail for both in_block and transition_due states;
// this page's summary was a pure duplicate, not a different view.
//
// Daily habits card moved to Home 2026-08-29 (Carl) — it's part of the
// new "Today's Mission" card there (workout/steps/habits/nutrition, all
// "today" signals); this weekly-focused hub kept its existing "This week"
// cards instead of duplicating it.
export default async function DashboardPage() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return <NoMemberProfile />;
  }

  const [membership, coachProfile] = await Promise.all([getActiveMembership(member.id), getCoachProfile(member.id)]);

  const state = getCoachHomeState(member, membership);
  const lastCheckIn = coachProfile ? await getLastCheckIn(member.id) : null;
  const checkInState = getCheckInDueState(coachProfile, lastCheckIn, new Date());

  const showFullDashboard = state.kind === "trial_active" || state.kind === "subscriber";

  let recoveryStatus = null;
  let weeklyReview = null;
  let consistency = null;

  if (showFullDashboard && coachProfile) {
    const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
    const [recovery, review, weeks] = await Promise.all([
      getRecoveryStatus(member.id),
      getWeeklyReview(member.id, periodStart, periodEnd, member.gender),
      getWeeklyConsistency(member.id),
    ]);
    recoveryStatus = recovery;
    weeklyReview = review;
    consistency = weeks.find((w) => w.weeksAgo === 0) ?? { weeksAgo: 0, sessionsCompleted: 0 };
  }

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <div className="bg-card px-6 pb-6 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Today</p>
          </div>
          <MoreMenu />
        </div>
        <div className="mx-auto mt-6 w-full max-w-md">
          <WeekCalendarStrip />
        </div>
      </div>

      <div className="flex-1 space-y-5 px-6 pb-10 pt-6">
        <div className="mx-auto w-full max-w-md space-y-5">
          {state.kind === "no_trial" && <TrialBanner />}

          {state.kind === "trial_pending" && (
            <div className="card-light p-5">
              <p className="text-sm font-semibold">AI Coach trial ready</p>
              <p className="mt-1 text-sm text-card-light-muted">Book your next session and your 7-day trial starts automatically.</p>
              <Link href="/book" prefetch={false} className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                Book a session
              </Link>
            </div>
          )}

          {state.kind === "trial_expired" && (
            <div className="card-light p-5">
              <p className="text-sm font-semibold">Your trial has ended.</p>
              <p className="mt-1 text-sm text-card-light-muted">Upgrade to keep your AI Coach ready every session.</p>
              <Link href="/buy-membership" className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                Upgrade
              </Link>
            </div>
          )}

          {showFullDashboard && (
            <>
              {recoveryStatus && <RecoveryStatusCard status={recoveryStatus} />}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">This week</p>
                <div className="space-y-3">
                  {consistency && coachProfile && (
                    <div className="card-light p-5">
                      <p className="text-sm font-semibold">Sessions</p>
                      <p className="mt-1 text-sm text-card-light-muted">
                        {consistency.sessionsCompleted} / {coachProfile.sessions_per_week}{" "}
                        {consistency.sessionsCompleted >= coachProfile.sessions_per_week ? (
                          <span className="text-success">on track</span>
                        ) : (
                          <span>this week</span>
                        )}
                      </p>
                    </div>
                  )}

                  {weeklyReview && (
                    <div className="card-light p-5">
                      <p className="text-sm font-semibold">Avg. nutrition</p>
                      {weeklyReview.avgDailyCalories === null ? (
                        <p className="mt-1 text-sm text-card-light-muted">No meals logged this week yet.</p>
                      ) : (
                        <>
                          <p className="mt-1 text-sm">{weeklyReview.avgDailyCalories} kcal</p>
                          <p className="mt-1 text-xs text-card-light-muted">
                            P: {weeklyReview.avgDailyProteinG}g | C: {weeklyReview.avgDailyCarbsG}g | F: {weeklyReview.avgDailyFatG}g
                          </p>
                        </>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {coachProfile && (
                <Link href="/coach/checkin" prefetch={false} className="card-light block p-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Check-in</p>
                  {checkInState.kind === "not_due" && (
                    <>
                      <p className="text-sm font-semibold">
                        {checkInState.daysRemaining} {checkInState.daysRemaining === 1 ? "day" : "days"} to your next check-in
                      </p>
                      <p className="mt-1 text-sm text-card-light-muted">Due {checkInState.nextDueDate}.</p>
                    </>
                  )}
                  {checkInState.kind === "due" && (
                    <>
                      <p className="text-sm font-semibold text-warning">Check-in ready</p>
                      <p className="mt-1 text-sm text-card-light-muted">See how your week went →</p>
                    </>
                  )}
                  {checkInState.kind === "overdue" && (
                    <>
                      <p className="text-sm font-semibold text-danger">
                        Check-in overdue by {checkInState.daysOverdue} {checkInState.daysOverdue === 1 ? "day" : "days"}
                      </p>
                      <p className="mt-1 text-sm text-card-light-muted">See how your week went →</p>
                    </>
                  )}
                </Link>
              )}

              <Link href="/leaderboard" prefetch={false} className="card-light flex flex-col items-center p-5 text-center">
                <TrophyIcon className="h-6 w-6 text-card-light-foreground" />
                <p className="mt-2 text-sm font-semibold">Leaderboard</p>
                <p className="mt-1 text-sm text-card-light-muted">See how you stack up against everyone else — sessions, streaks and steps, every gym.</p>
              </Link>

              {!coachProfile && (
                <div className="card-light p-5 text-center">
                  <p className="text-sm font-semibold">Set up Pod Coach</p>
                  <p className="mt-1 text-sm text-card-light-muted">Answer a few quick questions to unlock your personalised AI Coach plan.</p>
                  <Link
                    href="/coach-onboarding"
                    prefetch={false}
                    className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white"
                  >
                    Set up Pod Coach
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
