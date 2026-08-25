import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getMonthlySessionsLeaderboard, getWeeklyStepsLeaderboard, getStreakLeaderboard } from "@/lib/coach/leaderboard";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { MoreMenu } from "@/components/more-menu";
import { LeaderboardView } from "@/components/leaderboard-view";

// Multi-site leaderboard (2026-08-25) — one shared board across every
// gym, open to every member regardless of premium status: "sessions this
// month" and "current streak" are both grounded in real Kisi unlocks
// (pod_access_events.success, not bookings.status — see
// leaderboard.ts's own comment for why that column can't be trusted),
// and "steps this week" comes from the wearable data every member can
// now connect. Nobody appears on any board until they opt in
// (members.leaderboard_opt_in, off by default) — see NoMemberProfile-
// style privacy caution elsewhere in this app for the same reasoning.
export default async function LeaderboardPage() {
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

  const [sessions, streaks, steps] = await Promise.all([
    getMonthlySessionsLeaderboard(member.id),
    getStreakLeaderboard(member.id),
    getWeeklyStepsLeaderboard(member.id),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Leaderboard" subtitle="Every gym, one board" rightSlot={<MoreMenu />} />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <LeaderboardView initialOptedIn={member.leaderboard_opt_in} initialSessions={sessions} initialStreaks={streaks} initialSteps={steps} />
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
