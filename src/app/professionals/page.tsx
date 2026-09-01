import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getActiveProfessionals } from "@/lib/data/professionals";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { BottomNav } from "@/components/bottom-nav";
import { PodAssistBubble } from "@/components/pod-assist-bubble";
import { ProfessionalsDirectory } from "@/components/professionals-directory";

// "Find a Professional" (2026-08-27, modelled on Solo60's "Professional"
// tab) — a PT directory with an inquiry form, not instant slot booking.
// Open to every member, not premium-gated — a PAYG member wanting a
// trainer is a real case too. Uses the main BottomNav rather than
// MemberBottomNav for the same reason leaderboard/page.tsx does: reached
// from a Dashboard card, but not itself part of "the coaching
// environment," so it shouldn't feel like a context switch into that
// 4-tab sub-app.
export default async function ProfessionalsPage() {
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

  const professionals = await getActiveProfessionals();

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Find a Professional" subtitle="Personal trainers at your gym" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <ProfessionalsDirectory professionals={professionals} />
        </div>
      </div>
      <PodAssistBubble />
      <BottomNav />
    </main>
  );
}
