import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { CREDIT_PACKAGES } from "@/lib/credit-packages";
import { BuyCreditsList } from "@/components/buy-credits-list";

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
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-sm text-danger">No member profile found for this account.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-12">
      <h1 className="mb-4 text-lg font-semibold">Buy credits</h1>
      <BuyCreditsList packages={CREDIT_PACKAGES} />
    </main>
  );
}
