import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
import { getMembershipTiers } from "@/lib/data/catalog";
import { GYM_NAMES } from "@/lib/gym";
import { BuyMembershipList } from "@/components/buy-membership-list";
import { GuestGymPicker } from "@/components/guest-gym-picker";
import { PageHero } from "@/components/page-hero";
import { IdCardIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";

function isGymName(value: string): value is (typeof GYM_NAMES)[number] {
  return (GYM_NAMES as readonly string[]).includes(value);
}

export default async function BuyMembershipPage({ searchParams }: { searchParams: Promise<{ gym?: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  // Signed-out visitors can browse a gym's memberships (Apple guideline
  // 5.1.1(v)); subscribing still needs an account — the list swaps its
  // Subscribe buttons for a sign-in link, and /api/checkout-membership
  // stays behind proxy.ts's auth gate regardless.
  if (!user) {
    const params = await searchParams;
    const gym = params.gym && isGymName(params.gym) ? params.gym : GYM_NAMES[0];
    const membershipTiers = await getMembershipTiers(gym);
    return (
      <main className="flex min-h-full flex-1 flex-col">
        <PageHero title="Memberships" subtitle="A monthly credit allowance, billed automatically." />
        <div className="flex-1 px-6 pb-10 pt-8">
          <div className="mx-auto w-full max-w-md card-light space-y-4 p-6">
            <GuestGymPicker gym={gym} />
            {membershipTiers.length === 0 ? (
              <p className="text-sm text-card-light-muted">No memberships are available at {gym} yet.</p>
            ) : (
              <BuyMembershipList tiers={membershipTiers} currentTierId={null} guest />
            )}
            {/* The native shell has no back button. */}
            <Link href="/shop" className="inline-block text-sm text-card-light-muted hover:text-card-light-foreground">
              Back to shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return <NoMemberProfile />;
  }

  const [activeMembership, membershipTiers] = await Promise.all([getActiveMembership(member.id), getMembershipTiers(member.gym)]);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Buy membership" subtitle="A monthly credit allowance, billed automatically." icon={IdCardIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <BuyMembershipList tiers={membershipTiers} currentTierId={activeMembership?.tier_id ?? null} />
        </div>
      </div>
    </main>
  );
}
