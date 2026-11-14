import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { PageHero } from "@/components/page-hero";
import { GiftIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { BuyVoucherForm } from "@/components/buy-voucher-form";

export default async function GiftVoucherPage() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  // Signed-out visitors can browse voucher amounts (Apple guideline
  // 5.1.1(v) — the 12 Nov rejection's screenshot showed Gift Voucher as one
  // of the three Shop products). Buying still needs an account.
  if (!user) {
    return (
      <main className="flex min-h-full flex-1 flex-col">
        <PageHero title="Gift Voucher" subtitle="Give the gift of wellness." />
        <div className="flex-1 px-6 pb-10 pt-8">
          <div className="mx-auto w-full max-w-md card-light p-6">
            <BuyVoucherForm guest />
          </div>
        </div>
      </main>
    );
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return <NoMemberProfile />;
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Gift Voucher" subtitle="Give the gift of wellness." icon={GiftIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <BuyVoucherForm />
        </div>
      </div>
    </main>
  );
}
