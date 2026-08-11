import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getCreditBalance, getBookingsForDate, getPodConfig } from "@/lib/data/member";
import { parseDateParam, formatDateParam } from "@/lib/booking-dates";
import { BookingGrid } from "@/components/booking-grid";
import { NoMemberProfile } from "@/components/no-member-profile";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string; membership?: string; date?: string }>;
}) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const selectedDate = parseDateParam(params.date);

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return <NoMemberProfile />;
  }

  const [credits, dayBookings, podConfig] = await Promise.all([
    getCreditBalance(member.id),
    getBookingsForDate(member.gym, selectedDate),
    getPodConfig(member.gym),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <BookingGrid
        key={formatDateParam(selectedDate)}
        gym={member.gym}
        memberName={member.name}
        memberId={member.id}
        initialCredits={credits}
        initialBookings={dayBookings}
        selectedDate={formatDateParam(selectedDate)}
        purchaseSuccess={params.purchase === "success"}
        membershipSuccess={params.membership === "success"}
        openHour={podConfig.openHour}
        closeHour={podConfig.closeHour}
        podCapacity={podConfig.podCapacity}
      />
    </main>
  );
}
