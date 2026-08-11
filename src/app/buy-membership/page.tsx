import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { MEMBERSHIP_TIERS } from "@/lib/membership-tiers";
import { BuyMembershipList } from "@/components/buy-membership-list";
import { PageHero } from "@/components/page-hero";
import { IdCardIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";

export default async function BuyMembershipPage() {
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
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Buy membership" subtitle="A monthly credit allowance, billed automatically." icon={IdCardIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <BuyMembershipList tiers={MEMBERSHIP_TIERS} />
        </div>
      </div>
    </main>
  );
}
