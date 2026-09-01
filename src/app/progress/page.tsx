import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium, hasAcceptedPrivacyPolicy } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getWearableConnection, getLatestWearableSnapshot, getRecentWearableSnapshots } from "@/lib/data/wearables";
import { getRecoveryStatus } from "@/lib/coach/recovery-status";
import { averageInWindow } from "@/lib/coach/wearable-averages";
import { getBodyMeasurementHistory } from "@/lib/coach/body-measurements";
import { getYearToDateVolumeKg } from "@/lib/coach/workout-session";
import { getLastCheckIn } from "@/lib/coach/check-ins";
import { getCheckInDueState } from "@/lib/coach/checkin-state";
import { getCoachConversation } from "@/lib/coach/coach-conversations";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { PodCoachBubble } from "@/components/pod-coach-bubble";
import { WearableConnectionCard } from "@/components/wearable-connection-card";
import { RecoveryStatusCard } from "@/components/recovery-status-card";
import { StepGauge } from "@/components/step-gauge";
import { HealthMetricCard } from "@/components/health-metric-card";
import { BodyMeasurementTrends } from "@/components/body-measurement-trends";

const MONTHLY_WINDOW_DAYS = 30;
const TREND_FETCH_DAYS = MONTHLY_WINDOW_DAYS + 5;

// Premium's "More" destination (2026-09-01), replacing Health/Leaderboard
// there — those two are non-premium's More items instead now (see
// more-menu.tsx), reachable from Profile's Activity section for everyone
// regardless of premium status. Progress consolidates what used to be
// scattered across three places: wearable metrics (was /health's own
// content, still is for non-premium members — this doesn't replace that
// page, just adds a richer premium destination), body measurements (was
// /coach/profile), and a new year-to-date volume headline stat. Training's
// own per-exercise progress charts (ExerciseProgressPicker,
// ConsistencyChart) deliberately stay on /training, not moved here —
// Carl: keep the individual detail there, add a cumulative summary here
// instead of duplicating it.
export default async function ProgressPage() {
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

  if (!(await hasPremium(member))) {
    redirect("/dashboard");
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    redirect("/coach-onboarding");
  }

  const wearableConnection = await getWearableConnection(member.id);
  const [wearableSnapshot, recentSnapshots, recoveryStatus, measurementHistory, ytdVolumeKg, lastCheckIn, conversation] =
    await Promise.all([
      wearableConnection ? getLatestWearableSnapshot(member.id) : Promise.resolve(null),
      wearableConnection ? getRecentWearableSnapshots(member.id, TREND_FETCH_DAYS) : Promise.resolve([]),
      getRecoveryStatus(member.id),
      getBodyMeasurementHistory(member.id),
      getYearToDateVolumeKg(member.id),
      getLastCheckIn(member.id),
      getCoachConversation(member.id),
    ]);
  const checkInState = getCheckInDueState(coachProfile, lastCheckIn, new Date());

  // Same merge-by-date-then-sort as /health — see that page's own comment.
  const byDate = new Map(recentSnapshots.map((s) => [s.recordedDate, s]));
  if (wearableSnapshot) byDate.set(wearableSnapshot.recordedDate, wearableSnapshot);
  const trend = Array.from(byDate.values()).sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));

  const stepPoints = trend.filter((s) => s.steps !== null).map((s) => ({ date: s.recordedDate, value: s.steps! }));
  const sleepPoints = trend.filter((s) => s.sleepMinutes !== null).map((s) => ({ date: s.recordedDate, value: s.sleepMinutes! }));
  const restingHrPoints = trend.filter((s) => s.restingHeartRate !== null).map((s) => ({ date: s.recordedDate, value: s.restingHeartRate! }));
  const hrvPoints = trend.filter((s) => s.hrvMs !== null).map((s) => ({ date: s.recordedDate, value: s.hrvMs! }));

  const now = new Date();
  const weeklyAvgSteps = averageInWindow(stepPoints, now, 7);
  const monthlyAvgSteps = averageInWindow(stepPoints, now, MONTHLY_WINDOW_DAYS);
  const weeklyAvgSleep = averageInWindow(sleepPoints, now, 7);
  const monthlyAvgSleep = averageInWindow(sleepPoints, now, MONTHLY_WINDOW_DAYS);
  const weeklyAvgRestingHr = averageInWindow(restingHrPoints, now, 7);
  const monthlyAvgRestingHr = averageInWindow(restingHrPoints, now, MONTHLY_WINDOW_DAYS);
  const weeklyAvgHrv = averageInWindow(hrvPoints, now, 7);
  const monthlyAvgHrv = averageInWindow(hrvPoints, now, MONTHLY_WINDOW_DAYS);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Progress" subtitle="Your training, body and recovery, together" />
      <div className="flex-1 space-y-6 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="card-light p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">This year</p>
            <p className="mt-1 text-3xl font-semibold">{Math.round(ytdVolumeKg).toLocaleString("en-GB")}kg</p>
            <p className="mt-1 text-sm text-card-light-muted">lifted so far</p>
          </div>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recovery</p>
            <RecoveryStatusCard status={recoveryStatus} />
            <div className="mt-3 card-light">
              <Suspense fallback={null}>
                <WearableConnectionCard
                  connected={!!wearableConnection}
                  provider={wearableConnection?.provider ?? null}
                  lastSyncedDate={wearableSnapshot?.recordedDate ?? null}
                />
              </Suspense>
            </div>
          </section>

          {wearableConnection && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trends</p>
              <StepGauge current={wearableSnapshot?.steps ?? null} points={stepPoints} weeklyAvg={weeklyAvgSteps} monthlyAvg={monthlyAvgSteps} />
              <HealthMetricCard
                label="Sleep"
                unit=""
                current={wearableSnapshot?.sleepMinutes ?? null}
                points={sleepPoints}
                weeklyAvg={weeklyAvgSleep}
                monthlyAvg={monthlyAvgSleep}
                formatAs="duration"
              />
              <HealthMetricCard
                label="Resting heart rate"
                unit=" bpm"
                current={wearableSnapshot?.restingHeartRate ?? null}
                points={restingHrPoints}
                weeklyAvg={weeklyAvgRestingHr}
                monthlyAvg={monthlyAvgRestingHr}
              />
              <HealthMetricCard label="HRV" unit="ms" current={wearableSnapshot?.hrvMs ?? null} points={hrvPoints} weeklyAvg={weeklyAvgHrv} monthlyAvg={monthlyAvgHrv} />
            </section>
          )}

          {measurementHistory.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Body measurements</p>
              <div className="card-light p-6">
                <BodyMeasurementTrends history={measurementHistory} />
              </div>
            </section>
          )}
        </div>
      </div>
      <PodCoachBubble
        checkInState={checkInState}
        initialMessages={conversation.map((m) => ({ role: m.role, content: m.content }))}
        hasAcceptedPrivacyPolicy={hasAcceptedPrivacyPolicy(member)}
      />
      <MemberBottomNav />
    </main>
  );
}
