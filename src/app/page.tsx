import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import {
  getMemberByAuthUserId,
  getTotalCreditBalance,
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
import { TodaysMissionCard } from "@/components/todays-mission-card";
import { MemberHabitCard } from "@/components/member-habit-card";
import { CoachResponseCard } from "@/components/coach-response-card";
import { getCoachHomeState } from "@/lib/coach/trial-state";
import { getTodaysMission } from "@/lib/coach/todays-mission";
import { getActiveHabits, getTodayProgress } from "@/lib/coach/daily-habits";
import { getRecentCheckIns, getLatestCheckInResponse } from "@/lib/coach/check-ins";
import { computeHabitStreak } from "@/lib/coach/habit-streak";
import { TrophyIcon, UsersIcon } from "@/components/icons";

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
    getTotalCreditBalance(member.id),
    getActiveMembership(member.id),
    getNextUpcomingBooking(member.id),
    getPodResourcesForGym(member.gym),
  ]);

  const coachState = getCoachHomeState(member, membership);
  const showTodaysMission = coachState.kind === "trial_active" || coachState.kind === "subscriber";

  const [mission, habits, habitProgress] = showTodaysMission
    ? await Promise.all([getTodaysMission(member.id, member.gym, member.gender), getActiveHabits(member.id), getTodayProgress(member.id)])
    : [null, [], new Map<number, number>()];
  const habitsWithProgress = habits.map((h) => ({ ...h, todayCount: habitProgress.get(h.id) ?? 0 }));

  // Check-in feedback on the Home dashboard (2026-08-30) — the weekly
  // check-in's habit/streak and the coach's actual response used to only
  // ever surface on /coach, a tab a member has to specifically go looking
  // for; the response itself wasn't even saved anywhere before this. Same
  // premium/trial gate as the rest of the AI Coach content on this page.
  const [recentCheckIns, checkInResponse] = showTodaysMission
    ? await Promise.all([getRecentCheckIns(member.id), getLatestCheckInResponse(member.id)])
    : [[], null];
  const currentHabit = recentCheckIns[0]?.habit ?? null;
  const habitStreak = computeHabitStreak(recentCheckIns);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <div id="tour-greeting" className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">Hello, {member.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{member.gym}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          <AICoachSection state={coachState} />

          {showTodaysMission && (
            <>
              <CoachResponseCard response={checkInResponse} />
              <MemberHabitCard habit={currentHabit} streakWeeks={habitStreak} />
            </>
          )}

          {showTodaysMission && mission && <TodaysMissionCard mission={mission} initialHabits={habitsWithProgress} />}

          {!membership && (
            <div className="card-light border-2 border-card-light-foreground p-5">
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
              <div className="card-light p-5 text-center">
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

          <Link href="/leaderboard" prefetch={false} className="card-light flex flex-col items-center p-5 text-center">
            <TrophyIcon className="h-6 w-6 text-card-light-foreground" />
            <p className="mt-2 text-base font-semibold">Leaderboard</p>
            <p className="mt-1 text-sm text-card-light-muted">See how you stack up against everyone else — sessions, streaks and steps, every gym.</p>
          </Link>

          <Link href="/professionals" prefetch={false} className="card-light flex flex-col items-center p-5 text-center">
            <UsersIcon className="h-6 w-6 text-card-light-foreground" />
            <p className="mt-2 text-base font-semibold">Find a professional</p>
            <p className="mt-1 text-sm text-card-light-muted">Browse personal trainers at your gym and get in touch.</p>
          </Link>

          <p id="tour-credits" className="text-center text-sm text-muted-foreground">{credits} credits available</p>
        </div>
      </div>
      <OnboardingTour tourCompletedAt={member.tour_completed_at} />
      <BottomNav />
    </main>
  );
}
