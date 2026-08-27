import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
import { getCreditPackages, getClaimedOneTimeItemIds } from "@/lib/data/catalog";
import { GYM_NAMES } from "@/lib/gym";
import { BuyCreditsList } from "@/components/buy-credits-list";
import { PageHero } from "@/components/page-hero";
import { CoinIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { RedeemVoucherForm } from "@/components/redeem-voucher-form";

function isGymName(value: string): value is (typeof GYM_NAMES)[number] {
  return (GYM_NAMES as readonly string[]).includes(value);
}

export default async function BuyCreditsPage({ searchParams }: { searchParams: Promise<{ gym?: string }> }) {
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

  // Which gym this purchase prices/pays out to (2026-08-26) — carried
  // from /book's "Buy more" link so buying while browsing another gym
  // actually prices and pays that gym, not always home. Same trust
  // model as /book's own ?gym= — anyone can browse any gym's catalog,
  // there's no "ownership" concept for pricing the way there is for
  // booking a physical resource, so no membership/PAYG gating needed
  // here, just a valid-gym-name check.
  const params = await searchParams;
  const gym = params.gym && isGymName(params.gym) ? params.gym : member.gym;

  const [creditPackages, claimedItemIds, membership] = await Promise.all([
    getCreditPackages(gym),
    getClaimedOneTimeItemIds(member.id),
    getActiveMembership(member.id),
  ]);

  // Subscriber top-up discount (2026-08-26): whether *this member* is
  // eligible in principle — a founding member's own 20% discount already
  // wins over this 10% one at checkout (/api/checkout), so it shouldn't
  // be previewed for them too. Founding Member's own discount isn't
  // previewed here either (pre-existing gap, not this change's job to
  // fix). Per-item eligibility (pkg.networkEligible — excludes PT/Recovery
  // packs) is checked in BuyCreditsList itself, not here.
  const isSubscriber = !member.founding_member && membership !== null;

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero
        title={gym === member.gym ? "Buy credits" : `Buy credits — ${gym}`}
        subtitle={
          gym === member.gym
            ? "Top up to book more pod sessions."
            : `Priced and paid to ${gym} — you're buying this to spend there, not your home gym.`
        }
        icon={CoinIcon}
        iconHref="/profile"
      />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="card-light p-6">
            <BuyCreditsList
              packages={creditPackages.map((pkg) => ({ ...pkg, alreadyClaimed: claimedItemIds.has(pkg.id) }))}
              isSubscriber={isSubscriber}
              gym={gym === member.gym ? undefined : gym}
            />
          </div>
          <div className="card-light p-6">
            <RedeemVoucherForm />
          </div>
        </div>
      </div>
    </main>
  );
}
