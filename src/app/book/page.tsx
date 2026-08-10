import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getCreditBalance, getTodaysBookings } from "@/lib/data/member";
import { BookingGrid } from "@/components/booking-grid";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-sm text-danger">No member profile found for this account.</p>
      </main>
    );
  }

  const [credits, todaysBookings] = await Promise.all([
    getCreditBalance(member.id),
    getTodaysBookings(member.gym),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <BookingGrid
        gym={member.gym}
        memberName={member.name}
        memberId={member.id}
        initialCredits={credits}
        initialBookings={todaysBookings}
        purchaseSuccess={params.purchase === "success"}
      />
    </main>
  );
}
