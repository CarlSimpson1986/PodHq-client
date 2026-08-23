import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium, getNextUpcomingBooking } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getExercisePerformanceHistory } from "@/lib/coach/exercise-performance";
import { getWeeklyConsistency } from "@/lib/coach/consistency";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { CoachBottomNav } from "@/components/coach-bottom-nav";
import { DumbbellIcon } from "@/components/icons";
import { SectionHeading, ComingSoonCard } from "@/components/coach-section";
import { ExerciseProgressAccordion } from "@/components/exercise-progress-accordion";
import { ConsistencyChart } from "@/components/consistency-chart";

// The Training tab — renamed from "Workout" and reworked (Carl's call,
// 2026-08-23, mid-session, in two passes): first replaced the flat
// chronological session list with a week-by-week peak-weight graph per
// exercise; then, once eleven stacked charts read as noisy, moved that
// section behind a collapsed disclosure and added a consistency graph
// (sessions completed vs. the member's own sessions_per_week goal) plus
// a "current training block" slot. Same hasPremium + coachProfile gate
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

  const [upcomingBooking, performanceHistory, consistency] = await Promise.all([
    getNextUpcomingBooking(member.id),
    getExercisePerformanceHistory(member.id),
    getWeeklyConsistency(member.id),
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
            <SectionHeading>Progress</SectionHeading>
            {performanceHistory.length === 0 ? (
              <p className="text-sm text-card-light-muted">Complete a few sessions to see your progress here.</p>
            ) : (
              <ExerciseProgressAccordion performanceHistory={performanceHistory} />
            )}
          </section>

          <section>
            <SectionHeading>Current training block</SectionHeading>
            <ComingSoonCard
              title="Training blocks"
              body="Rotating exercise selection and rep ranges every few weeks to keep progress moving — coming soon."
            />
          </section>

          <section>
            <SectionHeading>Consistency</SectionHeading>
            <ConsistencyChart weeks={consistency} targetPerWeek={coachProfile.sessions_per_week} />
          </section>
        </div>
      </div>
      <CoachBottomNav />
    </main>
  );
}
