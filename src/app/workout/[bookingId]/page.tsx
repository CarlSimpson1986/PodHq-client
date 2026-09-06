import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { DumbbellIcon } from "@/components/icons";
import { WorkoutView } from "@/components/workout-view";

export default async function WorkoutPage({ params }: { params: Promise<{ bookingId: string }> }) {
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
    redirect("/");
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    redirect("/coach-onboarding");
  }

  const { bookingId } = await params;
  const bookingIdNum = Number(bookingId);
  if (!Number.isInteger(bookingIdNum) || bookingIdNum <= 0) {
    redirect("/");
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Today's Workout" icon={DumbbellIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <WorkoutView bookingId={bookingIdNum} />
        </div>
      </div>
    </main>
  );
}
