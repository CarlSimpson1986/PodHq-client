import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { CREDIT_PACKAGES } from "@/lib/credit-packages";
import { BuyCreditsList } from "@/components/buy-credits-list";
import { PageHero } from "@/components/page-hero";
import { CoinIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";

export default async function BuyCreditsPage() {
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
      <PageHero title="Buy credits" subtitle="Top up to book more pod sessions." icon={CoinIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <BuyCreditsList packages={CREDIT_PACKAGES} />
        </div>
      </div>
    </main>
  );
}
