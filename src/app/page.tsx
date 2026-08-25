import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import {
  getMemberByAuthUserId,
  getCreditBalance,
  getActiveMembership,
  getNextUpcomingBooking,
  getPodResourcesForGym,
  isAccessComplete,
} from "@/lib/data/member";
import { NoMemberProfile } from "@/components/no-member-profile";
import { BottomNav } from "@/components/bottom-nav";
import { UpcomingSessionCard } from "@/components/upcoming-session-card";
import { OnboardingTour } from "@/components/onboarding-tour";
import { AICoachSection } from "@/components/ai-coach-section";
import { getCoachHomeState } from "@/lib/coach/trial-state";

export default async function HomePage() {
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

  const [credits, membership, upcomingBooking, resources] = await Promise.all([
    getCreditBalance(member.id),
    getActiveMembership(member.id),
    getNextUpcomingBooking(member.id),
    getPodResourcesForGym(member.gym),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <div id="tour-greeting" className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">Hello, {member.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{member.gym}</p>
        </div>
      </div>

      <div className="card-light flex-1 space-y-4 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          <AICoachSection state={getCoachHomeState(member, membership)} />

          {!membership && (
            <div className="rounded-xl border-2 border-card-light-foreground p-5">
              <p className="text-base font-semibold">Get Your Membership</p>
              <p className="mt-1 text-sm text-card-light-muted">Get started with a monthly credit allowance.</p>
              <Link
                href="/buy-membership"
                className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Get Membership
              </Link>
            </div>
          )}

          <div id="tour-session-card">
            {upcomingBooking ? (
              <UpcomingSessionCard
                booking={upcomingBooking}
                accessComplete={isAccessComplete(member)}
                slotDurationMinutes={resources.find((r) => r.id === upcomingBooking.resource_id)?.slotDurationMinutes ?? 60}
              />
            ) : (
              <div className="rounded-xl border border-card-light-border p-5 text-center">
                <p className="text-base font-semibold">No upcoming sessions</p>
                <p className="mt-1 text-sm text-card-light-muted">Book a session to set your goals in motion.</p>
                <Link
                  href="/book"
                  className="mt-3 inline-block rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
                >
                  Book Session
                </Link>
              </div>
            )}
          </div>

          <Link href="/leaderboard" className="block rounded-xl border border-card-light-border p-5">
            <p className="text-base font-semibold">Leaderboard →</p>
            <p className="mt-1 text-sm text-card-light-muted">Sessions, streaks and steps — every gym, one board.</p>
          </Link>

          <p id="tour-credits" className="text-center text-sm text-card-light-muted">{credits} credits available</p>
        </div>
      </div>
      <OnboardingTour tourCompletedAt={member.tour_completed_at} />
      <BottomNav />
    </main>
  );
}
