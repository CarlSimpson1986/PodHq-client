import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { CoachBottomNav } from "@/components/coach-bottom-nav";
import { UserIcon } from "@/components/icons";
import { CoachProfileEditForm } from "@/components/coach-profile-edit-form";

// The Profile tab — metrics/goals/plan, editable (the earlier onboarding
// flow had no way to come back and change any of this afterwards).
export default async function CoachProfilePage() {
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

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Profile" subtitle="Your metrics, goals and plan" icon={UserIcon} iconHref="/profile" />
      <div className="card-light flex-1 space-y-8 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-8">
          <CoachProfileEditForm
            initial={{
              goal: coachProfile.goal,
              experienceLevel: coachProfile.experience_level,
              injuries: coachProfile.injuries ?? "",
              sessionsPerWeek: coachProfile.sessions_per_week,
              weightKg: coachProfile.weight_kg?.toString() ?? "",
              heightCm: coachProfile.height_cm?.toString() ?? "",
              age: coachProfile.age?.toString() ?? "",
              mealCountPreference: coachProfile.meal_count_preference?.toString() ?? "",
              foodAllergies: coachProfile.food_allergies ?? "",
              foodPreferences: coachProfile.food_preferences,
            }}
          />
        </div>
      </div>
      <CoachBottomNav />
    </main>
  );
}
