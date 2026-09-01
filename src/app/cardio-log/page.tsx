import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getEnabledCardioEquipmentForGym } from "@/lib/coach/cardio-equipment";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { CardioLogView } from "@/components/cardio-log-view";

// Cardio equipment logging (2026-08-30) — tap-through target from Today's
// Mission's Cardio row. Not premium-gated the way Today's Mission itself
// is: logging which machine you used isn't an AI Coach feature, just a
// basic log, so any signed-in member with a profile can reach it even
// though the only in-app link to it today is behind that gate.
export default async function CardioLogPage() {
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

  const equipment = await getEnabledCardioEquipmentForGym(member.gym);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Log Cardio" subtitle="Which machine did you use?" />
      <div className="flex-1 space-y-6 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <CardioLogView equipment={equipment} />
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
