import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { SparkleIcon } from "@/components/icons";
import { CheckInView } from "@/components/checkin-view";

// Stage 10b — the weekly check-in. Auto-generated "let's view your week"
// summary is real (weekly-review.ts); the reflection-question portion is
// an honest stub, not fabricated content — Carl's own call to define
// those later.
export default async function CheckInPage() {
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

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Check-in" subtitle="Your weekly review" icon={SparkleIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <CheckInView />
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
