import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getActiveHabits, getTodayProgress } from "@/lib/coach/daily-habits";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { MoreMenu } from "@/components/more-menu";
import { CoachProfileEditForm } from "@/components/coach-profile-edit-form";
import { DailyHabitsCard } from "@/components/daily-habits-card";

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
    redirect("/dashboard");
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    redirect("/coach-onboarding");
  }

  const [habits, progress] = await Promise.all([getActiveHabits(member.id), getTodayProgress(member.id)]);
  const habitsWithProgress = habits.map((h) => ({ ...h, todayCount: progress.get(h.id) ?? 0 }));

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Profile" subtitle="Your metrics, goals and plan" rightSlot={<MoreMenu />} />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="space-y-8 card-light p-6">
            <CoachProfileEditForm
              initial={{
                goal: coachProfile.goal,
                experienceLevel: coachProfile.experience_level,
                injuries: coachProfile.injuries ?? "",
                sessionsPerWeek: coachProfile.sessions_per_week,
                dailyActivityLevel: coachProfile.daily_activity_level,
                weightKg: coachProfile.weight_kg?.toString() ?? "",
                heightCm: coachProfile.height_cm?.toString() ?? "",
                age: coachProfile.age?.toString() ?? "",
                mealCountPreference: coachProfile.meal_count_preference?.toString() ?? "",
                foodAllergies: coachProfile.food_allergies ?? "",
                foodPreferences: coachProfile.food_preferences,
                nutritionTrackingMode: coachProfile.nutrition_tracking_mode,
              }}
            />
          </div>

          <DailyHabitsCard initialHabits={habitsWithProgress} />
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
