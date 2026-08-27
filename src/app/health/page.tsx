import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getWearableConnection, getLatestWearableSnapshot } from "@/lib/data/wearables";
import { getRecoveryStatus } from "@/lib/coach/recovery-status";
import { currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { BottomNav } from "@/components/bottom-nav";
import { MoreMenu } from "@/components/more-menu";
import { WearableConnectionCard } from "@/components/wearable-connection-card";
import { RecoveryStatusCard } from "@/components/recovery-status-card";
import { TrainingBlockView } from "@/components/training-block-view";

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
// did). Nutrition/Training sections still need a coach profile to mean
// anything — no food log or workout data exists without one — so a
// single upsell card replaces both rather than showing two empty states.
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

  const coachProfile = await getCoachProfile(member.id);

  const wearableConnection = await getWearableConnection(member.id);
  const [wearableSnapshot, recoveryStatus] = await Promise.all([
    wearableConnection ? getLatestWearableSnapshot(member.id) : Promise.resolve(null),
    getRecoveryStatus(member.id),
  ]);

  let weeklyReview = null;
  if (coachProfile) {
    const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
    weeklyReview = await getWeeklyReview(member.id, periodStart, periodEnd, member.gender);
  }

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero
        title="Health"
        subtitle={weeklyReview ? "Recovery, nutrition and training in one place" : "Your recovery data, connected"}
        rightSlot={<MoreMenu />}
      />
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

          {weeklyReview ? (
            <>
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nutrition this week</p>
                <div className="card-light p-5">
                  {weeklyReview.nutritionDaysLogged === 0 ? (
                    <p className="text-sm text-card-light-muted">No meals logged this week yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold">{weeklyReview.avgDailyCalories}</p>
                        <p className="text-xs text-card-light-muted">
                          Avg. daily kcal{weeklyReview.targets ? ` / ${weeklyReview.targets.calories}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{weeklyReview.avgDailyProteinG}g</p>
                        <p className="text-xs text-card-light-muted">
                          Avg. daily protein{weeklyReview.targets ? ` / ${weeklyReview.targets.proteinG}g` : ""}
                        </p>
                      </div>
                    </div>
                  )}
                  <Link href="/nutrition" prefetch={false} className="mt-4 inline-block text-xs font-semibold underline">
                    View nutrition →
                  </Link>
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Training</p>
                <div className="card-light">
                  <TrainingBlockView />
                </div>
                <Link href="/training" prefetch={false} className="mt-3 inline-block text-xs font-semibold text-accent underline">
                  View training progress →
                </Link>
              </section>
            </>
          ) : (
            <div className="card-light p-5">
              <p className="text-sm font-semibold">Want AI-personalised training and nutrition?</p>
              <p className="mt-1 text-sm text-card-light-muted">
                Set up your AI Coach to unlock programmed workouts, progress tracking, and a daily nutrition diary alongside your recovery data.
              </p>
              <Link
                href="/coach-onboarding"
                className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
              >
                Set up my AI Coach
              </Link>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
