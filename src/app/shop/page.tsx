import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { NoMemberProfile } from "@/components/no-member-profile";
import { BottomNav } from "@/components/bottom-nav";
import { PodAssistBubble } from "@/components/pod-assist-bubble";
import { IdCardIcon, CoinIcon, GiftIcon } from "@/components/icons";
import type { ComponentType } from "react";

const SHOP_ITEMS: {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    href: "/buy-membership",
    title: "Memberships",
    description: "Browse membership options available to join our club.",
    icon: IdCardIcon,
  },
  {
    href: "/buy-credits",
    title: "Credit Packs",
    description: "Browse credit packs available to book activities at our club.",
    icon: CoinIcon,
  },
  {
    href: "/gift-voucher",
    title: "Gift Voucher",
    description: "Give the gift of wellness with a gift voucher for our club.",
    icon: GiftIcon,
  },
];

export default async function ShopPage() {
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
      <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">Shop</h1>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-3">
          {SHOP_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="card-light flex items-start gap-4 p-5 hover:opacity-90">
              <item.icon className="mt-0.5 h-8 w-8 shrink-0 text-card-light-foreground" />
              <div>
                <p className="text-base font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-card-light-muted">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <PodAssistBubble />
      <BottomNav />
    </main>
  );
}
