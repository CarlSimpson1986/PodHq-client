import { redirect } from "next/navigation";
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

  if (!user) {
    redirect("/login");
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
