import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import {
  getMemberByAuthUserId,
  getCreditBalance,
  getBookingsForDate,
  getPodResourcesForGym,
  getMemberWaitlistSlots,
  getActiveReservationsForDate,
} from "@/lib/data/member";
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

  const [dayBookings, resources, waitlistSlots, reservations] = await Promise.all([
    getBookingsForDate(member.gym, selectedDate),
    getPodResourcesForGym(member.gym),
    getMemberWaitlistSlots(member.id),
    getActiveReservationsForDate(member.gym, selectedDate),
  ]);

  // Credit balance is per-resource's own credit type (Milestone 1: every
  // resource is still 'pod', so this is one query either way) — fetched
  // per resource rather than once, since a gym with a Recovery Suite
  // (Brighton, Milestone 2) needs each resource's own balance shown, not
  // one pooled number.
  const creditsByType: Record<string, number> = {};
  await Promise.all(
    Array.from(new Set(resources.map((r) => r.creditType))).map(async (creditType) => {
      creditsByType[creditType] = await getCreditBalance(member.id, creditType);
    })
  );

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <BookingGrid
        key={formatDateParam(selectedDate)}
        gym={member.gym}
        memberName={member.name}
        memberId={member.id}
        creditsByType={creditsByType}
        initialBookings={dayBookings}
        selectedDate={formatDateParam(selectedDate)}
        purchaseSuccess={params.purchase === "success"}
        membershipSuccess={params.membership === "success"}
        resources={resources}
        initialWaitlistSlots={waitlistSlots}
        reservations={reservations}
      />
    </main>
  );
}
