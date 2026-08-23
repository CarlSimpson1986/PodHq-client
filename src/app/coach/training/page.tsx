import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium, getNextUpcomingBooking } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getExercisePerformanceHistory } from "@/lib/coach/exercise-performance";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { CoachBottomNav } from "@/components/coach-bottom-nav";
import { DumbbellIcon } from "@/components/icons";
import { SectionHeading } from "@/components/coach-section";
import { ExerciseTrendChart } from "@/components/exercise-trend-chart";

// The Training tab — renamed from "Workout" and reworked (Carl's call,
// 2026-08-23, mid-session): the flat chronological session list read as
// less useful than seeing actual progress, so it's replaced with a
// week-by-week peak-weight graph per exercise instead — the same signal
// generate-workout.ts's RPE-driven adjustments are already tracking
// under the hood, just made visible. Same hasPremium + coachProfile gate
// as every other Coach page.
export default async function CoachTrainingPage() {
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

  const [upcomingBooking, performanceHistory] = await Promise.all([
    getNextUpcomingBooking(member.id),
    getExercisePerformanceHistory(member.id),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Training" subtitle="Your progress" icon={DumbbellIcon} iconHref="/profile" />
      <div className="card-light flex-1 space-y-8 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-8">
          <section>
            <SectionHeading>Next session</SectionHeading>
            {upcomingBooking ? (
              <Link
                href={`/workout/${upcomingBooking.id}`}
                className="block rounded-xl border border-card-light-border p-5"
              >
                <p className="text-sm font-semibold">Your personalised workout is ready.</p>
                <p className="mt-1 text-sm text-card-light-muted">View my workout →</p>
              </Link>
            ) : (
              <Link href="/book" className="block rounded-xl border border-card-light-border p-5">
                <p className="text-sm font-semibold">No session booked</p>
                <p className="mt-1 text-sm text-card-light-muted">Book a session to get your next personalised workout.</p>
              </Link>
            )}
          </section>

          <section>
            <SectionHeading>Progress by exercise</SectionHeading>
            {performanceHistory.length === 0 ? (
              <p className="text-sm text-card-light-muted">Complete a few sessions to see your progress here.</p>
            ) : (
              <div className="space-y-4">
                {performanceHistory.map((performance) => (
                  <ExerciseTrendChart key={performance.exerciseKey} performance={performance} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <CoachBottomNav />
    </main>
  );
}
