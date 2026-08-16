import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCreditPackages, getClaimedOneTimeItemIds } from "@/lib/data/catalog";
import { BuyCreditsList } from "@/components/buy-credits-list";
import { PageHero } from "@/components/page-hero";
import { CoinIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { RedeemVoucherForm } from "@/components/redeem-voucher-form";

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

  const [creditPackages, claimedItemIds] = await Promise.all([
    getCreditPackages(member.gym),
    getClaimedOneTimeItemIds(member.id),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Buy credits" subtitle="Top up to book more pod sessions." icon={CoinIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <BuyCreditsList
            packages={creditPackages.map((pkg) => ({ ...pkg, alreadyClaimed: claimedItemIds.has(pkg.id) }))}
          />
          <RedeemVoucherForm />
        </div>
      </div>
    </main>
  );
}
