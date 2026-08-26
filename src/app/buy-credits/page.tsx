import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
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

  const [creditPackages, claimedItemIds, membership] = await Promise.all([
    getCreditPackages(member.gym),
    getClaimedOneTimeItemIds(member.id),
    getActiveMembership(member.id),
  ]);

  // Subscriber top-up discount (2026-08-26): only shown when it'd actually
  // apply — a founding member's own 20% discount already wins over this
  // 10% one at checkout (/api/checkout), so showing this price to them too
  // would be wrong. Founding Member's own discount isn't previewed here
  // either (pre-existing gap, not this change's job to fix).
  const subscriberDiscount = !member.founding_member && membership !== null;

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Buy credits" subtitle="Top up to book more pod sessions." icon={CoinIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <BuyCreditsList
            packages={creditPackages.map((pkg) => ({ ...pkg, alreadyClaimed: claimedItemIds.has(pkg.id) }))}
            subscriberDiscount={subscriberDiscount}
          />
          <RedeemVoucherForm />
        </div>
      </div>
    </main>
  );
}
