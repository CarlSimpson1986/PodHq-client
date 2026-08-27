import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getCoachConversation } from "@/lib/coach/coach-conversations";
import { getLastCheckIn } from "@/lib/coach/check-ins";
import { getCheckInDueState, currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getRecoveryStatus } from "@/lib/coach/recovery-status";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { getWeeklyConsistency } from "@/lib/coach/consistency";
import { getWeeklyRecommendation } from "@/lib/coach/weekly-recommendation";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { MoreMenu } from "@/components/more-menu";
import { WeeklyRecommendationCard } from "@/components/weekly-recommendation-card";
import { CoachChatView } from "@/components/coach-chat-view";

// The Coach tab (2026-08-25 redesign, replacing the standalone Health
// tab — Carl: "the Health tab still seems a bit pointless... check in,
// ask the coach and recommendations"). Merges three things that were
// previously separate: this week's habit recommendation (new — see
// weekly-recommendation.ts), the check-in status (moved here from
// /dashboard's own card, though that card stays too), and the chat
// (unchanged, this route already was the chat as of the earlier
// same-day redesign). Same hasPremium + coachProfile gate as every
// other Coach page.
export default async function CoachPage() {
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

  const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
  const [lastCheckIn, recoveryStatus, weeklyReview, consistencyWeeks, conversation] = await Promise.all([
    getLastCheckIn(member.id),
    getRecoveryStatus(member.id),
    getWeeklyReview(member.id, periodStart, periodEnd, member.gender),
    getWeeklyConsistency(member.id),
    getCoachConversation(member.id),
  ]);

  const checkInState = getCheckInDueState(coachProfile, lastCheckIn, new Date());
  const sessionsCompleted = consistencyWeeks.find((w) => w.weeksAgo === 0)?.sessionsCompleted ?? 0;
  const recommendation = getWeeklyRecommendation(
    checkInState,
    sessionsCompleted,
    coachProfile.sessions_per_week,
    recoveryStatus,
    weeklyReview
  );

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Coach" subtitle="Check in, get a plan, ask anything" rightSlot={<MoreMenu />} />
      <div className="flex-1 space-y-4 px-6 pb-6 pt-6">
        <div className="mx-auto w-full max-w-md space-y-4">
          <WeeklyRecommendationCard recommendation={recommendation} />

          <Link href="/coach/checkin" prefetch={false} className="card-light block p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Check-in</p>
            {checkInState.kind === "not_due" && (
              <>
                <p className="text-sm font-semibold">
                  {checkInState.daysRemaining} {checkInState.daysRemaining === 1 ? "day" : "days"} to your next check-in
                </p>
                <p className="mt-1 text-sm text-card-light-muted">Due {checkInState.nextDueDate}.</p>
              </>
            )}
            {checkInState.kind === "due" && (
              <>
                <p className="text-sm font-semibold text-warning">Check-in ready</p>
                <p className="mt-1 text-sm text-card-light-muted">See how your week went →</p>
              </>
            )}
            {checkInState.kind === "overdue" && (
              <>
                <p className="text-sm font-semibold text-danger">
                  Check-in overdue by {checkInState.daysOverdue} {checkInState.daysOverdue === 1 ? "day" : "days"}
                </p>
                <p className="mt-1 text-sm text-card-light-muted">See how your week went →</p>
              </>
            )}
          </Link>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ask your coach</p>
            <CoachChatView initialMessages={conversation.map((m) => ({ role: m.role, content: m.content }))} />
          </div>
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
