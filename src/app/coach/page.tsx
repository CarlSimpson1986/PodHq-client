import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getCoachConversation } from "@/lib/coach/coach-conversations";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { SparkleIcon } from "@/components/icons";
import { CoachChatView } from "@/components/coach-chat-view";

// Repurposed in place (2026-08-25 redesign, see ROADMAP.md) — this used
// to be the Coach hub/"Dashboard" tab (moved to /dashboard); the URL
// /coach now means what it always implied: talk to your coach. Same
// hasPremium + coachProfile gate as every other Coach page.
export default async function CoachChatPage() {
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

  const conversation = await getCoachConversation(member.id);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Your Coach" subtitle="Ask anything, grounded in your own data" icon={SparkleIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-6 pt-6">
        <div className="mx-auto flex h-full w-full max-w-md flex-col">
          <CoachChatView initialMessages={conversation.map((m) => ({ role: m.role, content: m.content }))} />
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
