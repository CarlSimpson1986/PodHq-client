import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets } from "@/lib/coach/nutrition-targets";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { MoreMenu } from "@/components/more-menu";
import { NutritionView } from "@/components/nutrition-view";

// Moved from /coach/nutrition (2026-08-25 redesign, see ROADMAP.md).
// NutritionView itself is unchanged here — its full diary (ring, macro
// bars, meal sections, search/recent/barcode logging) stays on its
// existing white card-light surface; the hand-portions mode and meal
// suggestion generator are separate net-new additions layered on top of
// this same page.
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
      <PageHero title="Nutrition" subtitle="Your daily diary" rightSlot={<MoreMenu />} />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <NutritionView targets={targets} trackingMode={coachProfile.nutrition_tracking_mode} />
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
