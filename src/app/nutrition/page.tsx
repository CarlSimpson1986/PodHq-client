import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets } from "@/lib/coach/nutrition-targets";
import { NoMemberProfile } from "@/components/no-member-profile";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { NutritionView } from "@/components/nutrition-view";

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

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <NutritionView targets={targets} trackingMode={coachProfile.nutrition_tracking_mode} />
      <MemberBottomNav />
    </main>
  );
}
