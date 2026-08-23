import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium, getNextUpcomingBooking } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getRecentCompletedSessions } from "@/lib/coach/workout-session";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { CoachBottomNav } from "@/components/coach-bottom-nav";
import { DumbbellIcon } from "@/components/icons";
import { SectionHeading } from "@/components/coach-section";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

// The Workout tab — full session history, moved out of the Dashboard
// (Stage 10a had this as a "Workouts" section there) once the Coach
// section got its own dedicated nav. Same hasPremium + coachProfile gate
// as every other Coach page.
export default async function CoachWorkoutPage() {
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

  const [upcomingBooking, recentSessions] = await Promise.all([
    getNextUpcomingBooking(member.id),
    getRecentCompletedSessions(member.id, 20),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Workout" subtitle="Your training history" icon={DumbbellIcon} iconHref="/profile" />
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
            <SectionHeading>History</SectionHeading>
            {recentSessions.length === 0 ? (
              <p className="text-sm text-card-light-muted">Complete your first session to see it here.</p>
            ) : (
              <ul className="space-y-2">
                {recentSessions.map((s) => (
                  <li key={s.sessionId} className="flex items-center justify-between rounded-lg border border-card-light-border p-4">
                    <div>
                      <p className="text-sm font-semibold">{formatDate(s.createdAt)}</p>
                      <p className="text-xs text-card-light-muted">{s.muscleGroups.join(", ")}</p>
                    </div>
                    <p className="text-sm text-card-light-muted">{Math.round(s.totalVolumeKg)}kg</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <CoachBottomNav />
    </main>
  );
}
