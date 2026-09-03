import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium, hasAcceptedPrivacyPolicy } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets } from "@/lib/coach/nutrition-targets";
import { getLastCheckIn } from "@/lib/coach/check-ins";
import { getCheckInDueState } from "@/lib/coach/checkin-state";
import { getCoachConversation } from "@/lib/coach/coach-conversations";
import { NoMemberProfile } from "@/components/no-member-profile";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { NutritionView } from "@/components/nutrition-view";
import { PodCoachBubble } from "@/components/pod-coach-bubble";
import { CoachTourContinuation } from "@/components/coach-tour-continuation";

// Moved from /coach/nutrition (2026-08-25 redesign, see ROADMAP.md).
// NutritionView owns its own full page body — dark hero (with the date
// strip) plus the white card-light diary below — same pattern as
// booking-grid.tsx, not a PageHero + wrapper div at this level (found
// live 2026-08-27: nesting the date strip inside the white card put it
// on the wrong background with inverted colours, out of step with
// Book's identical-looking strip).
export default async function NutritionPage() {
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

  const targets = computeNutritionTargets(coachProfile, member.gender);
  const [lastCheckIn, conversation] = await Promise.all([getLastCheckIn(member.id), getCoachConversation(member.id)]);
  const checkInState = getCheckInDueState(coachProfile, lastCheckIn, new Date());

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <NutritionView targets={targets} trackingMode={coachProfile.nutrition_tracking_mode} />
      <PodCoachBubble
        checkInState={checkInState}
        initialMessages={conversation.map((m) => ({ role: m.role, content: m.content }))}
        hasAcceptedPrivacyPolicy={hasAcceptedPrivacyPolicy(member)}
      />
      <CoachTourContinuation path="/nutrition" />
      <MemberBottomNav />
    </main>
  );
}
