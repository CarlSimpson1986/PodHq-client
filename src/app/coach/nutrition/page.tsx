import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets } from "@/lib/coach/nutrition-targets";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { CoachBottomNav } from "@/components/coach-bottom-nav";
import { AppleIcon } from "@/components/icons";
import { NutritionView } from "@/components/nutrition-view";

// Same hasPremium + coachProfile gate as /workout/[bookingId], since
// targets are computed from the coach profile and aren't useful without
// one. Stage 6 shipped targets only; Stage 7 adds the MyFitnessPal/
// Nutracheck-style diary (calorie ring, macro bars, meal sections,
// search/recent/barcode logging) via NutritionView.
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
    redirect("/coach");
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    redirect("/coach-onboarding");
  }

  const targets = computeNutritionTargets(coachProfile, member.gender);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Nutrition" subtitle="Your daily diary" icon={AppleIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <NutritionView targets={targets} />
        </div>
      </div>
      <CoachBottomNav />
    </main>
  );
}
