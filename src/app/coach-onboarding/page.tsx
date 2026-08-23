import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { DumbbellIcon } from "@/components/icons";
import { CoachOnboardingForm } from "@/components/coach-onboarding-form";

export default async function CoachOnboardingPage() {
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

  // Already onboarded — nothing new to answer, back to Home.
  const existingProfile = await getCoachProfile(member.id);
  if (existingProfile) {
    redirect("/");
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Set up your AI Coach" subtitle="A few questions, one time only." icon={DumbbellIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <CoachOnboardingForm />
        </div>
      </div>
    </main>
  );
}
