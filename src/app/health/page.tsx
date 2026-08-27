import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getWearableConnection, getLatestWearableSnapshot, getRecentWearableSnapshots } from "@/lib/data/wearables";
import { getRecoveryStatus } from "@/lib/coach/recovery-status";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { BottomNav } from "@/components/bottom-nav";
import { MoreMenu } from "@/components/more-menu";
import { WearableConnectionCard } from "@/components/wearable-connection-card";
import { RecoveryStatusCard } from "@/components/recovery-status-card";
import { StepGauge } from "@/components/step-gauge";
import { HealthMetricCard } from "@/components/health-metric-card";

// Moved from /coach/health, then (same day, later) stopped being a
// primary tab at all — Carl felt it "seemed a bit pointless" as a
// standalone destination once Coach absorbed check-in/recommendations/
// chat, so this is now reached via the MoreMenu overflow instead of the
// bottom nav. RecoveryStatusCard (shared with Dashboard) leads the page
// so it's an actual signal, not just raw numbers. Never shows a
// fabricated composite "readiness score" — see recovery-status-card.tsx's
// comment for why no such field exists in the Google Health API.
//
// Opened to every member, not just AI Coach subscribers, 2026-08-25
// (Carl: "open it up" — feeds a universal step-count leaderboard, and
// the wearable connect/callback/refresh/disconnect API routes never
// actually checked premium status anyway, only this page's own redirect
// did).
//
// Nutrition/Training summary sections removed 2026-08-27 — both are
// already their own top-level tabs, so summarising them here again was a
// duplicate, same reasoning as removing Dashboard's "Ask your coach" and
// "Next session" tiles the same day. Replaced with real wearable metrics:
// a steps-vs-target gauge plus expandable resting-heart-rate/HRV trends,
// using getRecentWearableSnapshots (already existed, just never
// surfaced beyond the flat current-value grid in WearableConnectionCard).
// Sleep is deliberately left out of the trend widgets — Google Health's
// dailyRollUp has no sleep field at all yet (see
// wearable-connection-card.tsx's own comment), so there's no real data
// to trend; building that needs separate work first, not a chart with
// nothing in it.
//
// Renders the main app's BottomNav, not MemberBottomNav — same fix as
// /leaderboard, same day: a universal, not Coach-specific, page landing
// on the Coach-area's 4-tab nav read as an unexpected context switch.
export default async function HealthPage() {
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

  const wearableConnection = await getWearableConnection(member.id);
  const [wearableSnapshot, recentSnapshots, recoveryStatus] = await Promise.all([
    wearableConnection ? getLatestWearableSnapshot(member.id) : Promise.resolve(null),
    wearableConnection ? getRecentWearableSnapshots(member.id) : Promise.resolve([]),
    getRecoveryStatus(member.id),
  ]);

  // getRecentWearableSnapshots excludes today by construction (see its
  // own comment); getLatestWearableSnapshot is the only source for
  // today's row, if synced. Merged via a Map keyed on date so the two
  // never produce a duplicate point if the "latest" row happens to fall
  // inside the recent window too, then sorted oldest-first for a
  // left-to-right trend line.
  const byDate = new Map(recentSnapshots.map((s) => [s.recordedDate, s]));
  if (wearableSnapshot) byDate.set(wearableSnapshot.recordedDate, wearableSnapshot);
  const trend = Array.from(byDate.values()).sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));

  const stepPoints = trend.filter((s) => s.steps !== null).map((s) => ({ date: s.recordedDate, value: s.steps! }));
  const restingHrPoints = trend.filter((s) => s.restingHeartRate !== null).map((s) => ({ date: s.recordedDate, value: s.restingHeartRate! }));
  const hrvPoints = trend.filter((s) => s.hrvMs !== null).map((s) => ({ date: s.recordedDate, value: s.hrvMs! }));

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Health" subtitle="Your recovery data, connected" rightSlot={<MoreMenu />} />
      <div className="flex-1 space-y-6 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recovery</p>
            <RecoveryStatusCard status={recoveryStatus} />
            <div className="mt-3 card-light">
              <Suspense fallback={null}>
                <WearableConnectionCard connected={!!wearableConnection} snapshot={wearableSnapshot} />
              </Suspense>
            </div>
          </section>

          {wearableConnection && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trends</p>
              <StepGauge current={wearableSnapshot?.steps ?? null} points={stepPoints} />
              <HealthMetricCard label="Resting heart rate" unit=" bpm" current={wearableSnapshot?.restingHeartRate ?? null} points={restingHrPoints} />
              <HealthMetricCard label="HRV" unit="ms" current={wearableSnapshot?.hrvMs ?? null} points={hrvPoints} />
              <div className="card-light p-5">
                <p className="text-sm font-semibold">Sleep</p>
                <p className="mt-1 text-sm text-card-light-muted">
                  Not yet available — Google Health doesn&apos;t provide sleep data through the connection this app uses today.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
