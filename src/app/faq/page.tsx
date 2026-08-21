import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { PageHero } from "@/components/page-hero";
import { QuestionIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { BottomNav } from "@/components/bottom-nav";
import { FaqView } from "@/components/faq-view";
import { ReplayTourButton } from "@/components/replay-tour-button";
import { FAQ_ITEMS } from "@/lib/faq";

export default async function FaqPage() {
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

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Help" subtitle="Frequently asked questions." icon={QuestionIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          <ReplayTourButton />
          <FaqView items={FAQ_ITEMS} />
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
