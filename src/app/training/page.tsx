import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium, getNextUpcomingBooking } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getExercisePerformanceHistory } from "@/lib/coach/exercise-performance";
import { getWeeklyConsistency } from "@/lib/coach/consistency";
import { getLastCompletedSessionDetail } from "@/lib/coach/exercise-performance";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { DumbbellIcon } from "@/components/icons";
import { ExerciseProgressPicker } from "@/components/exercise-progress-picker";
import { LastSessionCard } from "@/components/last-session-card";
import { ConsistencyChart } from "@/components/consistency-chart";
import { TrainingBlockView } from "@/components/training-block-view";

// Moved from /coach/training (2026-08-25 redesign — flat top-level tabs,
// see ROADMAP.md). Functional change from the old page: the exercise
// progress section now uses a dropdown-driven single chart
// (ExerciseProgressPicker) instead of the all-exercises-stacked accordion,
// and a real "last session" card with per-set RPE badges (using the real
// 1-5 RPE_SCALE, not a 1-10 scale) — neither existed before this redesign.
export default async function TrainingPage() {
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

  const [upcomingBooking, performanceHistory, consistency, lastSession] = await Promise.all([
    getNextUpcomingBooking(member.id),
    getExercisePerformanceHistory(member.id),
    getWeeklyConsistency(member.id),
    getLastCompletedSessionDetail(member.id),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Training" subtitle="Your progress" icon={DumbbellIcon} iconHref="/profile" />
      <div className="flex-1 space-y-6 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next session</p>
            {upcomingBooking ? (
              <Link href={`/workout/${upcomingBooking.id}`} className="card-glass block p-5">
                <p className="text-sm font-semibold text-foreground">Your personalised workout is ready.</p>
                <p className="mt-1 text-sm text-muted-foreground">View my workout →</p>
              </Link>
            ) : (
              <Link href="/book" className="card-glass block p-5">
                <p className="text-sm font-semibold text-foreground">No session booked</p>
                <p className="mt-1 text-sm text-muted-foreground">Book a session to get your next personalised workout.</p>
              </Link>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last session</p>
            <LastSessionCard session={lastSession} />
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</p>
            {performanceHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Complete a few sessions to see your progress here.</p>
            ) : (
              <ExerciseProgressPicker performanceHistory={performanceHistory} />
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current training block</p>
            <div className="card-light">
              <TrainingBlockView />
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consistency</p>
            <div className="card-light">
              <ConsistencyChart weeks={consistency} targetPerWeek={coachProfile.sessions_per_week} />
            </div>
          </section>
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
