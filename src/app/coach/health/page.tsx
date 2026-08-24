import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getWearableConnection, getLatestWearableSnapshot } from "@/lib/data/wearables";
import { currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { CoachBottomNav } from "@/components/coach-bottom-nav";
import { HeartPulseIcon } from "@/components/icons";
import { SectionHeading } from "@/components/coach-section";
import { WearableConnectionCard } from "@/components/wearable-connection-card";
import { TrainingBlockView } from "@/components/training-block-view";

// Health Centre — brings recovery (wearable), nutrition, and training
// together on one screen, all reused from existing per-domain data
// functions/components (no new aggregation logic here beyond fetching
// them together). See recovery-signal.ts and applyRecoveryAdjustment in
// workout-session.ts for the one place recovery data actually feeds back
// into coaching (a member-confirmed suggestion on the workout overview
// screen) — nutrition and training here stay display-only, Carl's call.
export default async function CoachHealthPage() {
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
    redirect("/coach");
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    redirect("/coach-onboarding");
  }

  const wearableConnection = await getWearableConnection(member.id);
  const wearableSnapshot = wearableConnection ? await getLatestWearableSnapshot(member.id) : null;

  const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
  const weeklyReview = await getWeeklyReview(member.id, periodStart, periodEnd, member.gender);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Health" subtitle="Recovery, nutrition and training in one place" icon={HeartPulseIcon} iconHref="/profile" />
      <div className="card-light flex-1 space-y-8 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-8">
          <section>
            <SectionHeading>Recovery</SectionHeading>
            <Suspense fallback={null}>
              <WearableConnectionCard connected={!!wearableConnection} snapshot={wearableSnapshot} />
            </Suspense>
          </section>

          <section>
            <SectionHeading>Nutrition this week</SectionHeading>
            <div className="rounded-xl border border-card-light-border p-5">
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
              <Link href="/coach/nutrition" className="mt-4 inline-block text-xs font-semibold underline">
                View nutrition →
              </Link>
            </div>
          </section>

          <section>
            <SectionHeading>Training</SectionHeading>
            <TrainingBlockView />
            <Link href="/coach/training" className="mt-3 inline-block text-xs font-semibold underline">
              View training progress →
            </Link>
          </section>
        </div>
      </div>
      <CoachBottomNav />
    </main>
  );
}
