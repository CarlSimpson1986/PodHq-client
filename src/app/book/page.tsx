import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import {
  getMemberByAuthUserId,
  getCreditBalance,
  getTotalCreditBalance,
  networkCreditType,
  getBookingsForDate,
  getPodResourcesForGym,
  getMemberWaitlistSlots,
  getActiveReservationsForDate,
  getActiveMembership,
} from "@/lib/data/member";
import { GYM_NAMES } from "@/lib/gym";
import { parseDateParam, formatDateParam } from "@/lib/booking-dates";
import { BookingGrid } from "@/components/booking-grid";
import { NoMemberProfile } from "@/components/no-member-profile";

function isGymName(value: string): value is (typeof GYM_NAMES)[number] {
  return (GYM_NAMES as readonly string[]).includes(value);
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string; membership?: string; date?: string; gym?: string }>;
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

  // Cross-gym booking (2026-08-26, extended same day to cover membership
  // members too): a PAYG member can spend their base credit anywhere; a
  // membership member can too, but only via a separate "network" top-up
  // credit (podHq's 0064_pod_network_credit.sql) — their subscription
  // credit itself stays home-gym-only. Either way the gym switcher shows
  // for everyone now; ?gym= is server-enforced for real in /api/bookings
  // via create_booking()'s own credit-type check, not just hidden in the UI.
  const membership = await getActiveMembership(member.id);
  const viewGym = params.gym && isGymName(params.gym) ? params.gym : member.gym;
  const isHomeGymView = viewGym === member.gym;

  const [dayBookings, resources, waitlistSlots, reservations] = await Promise.all([
    getBookingsForDate(viewGym, selectedDate),
    getPodResourcesForGym(viewGym),
    getMemberWaitlistSlots(member.id),
    getActiveReservationsForDate(viewGym, selectedDate),
  ]);

  // Credit balance is per-resource's own credit type (Milestone 1: every
  // resource is still 'pod', so this is one query either way) — fetched
  // per resource rather than once, since a gym with a Recovery Suite
  // (Brighton, Milestone 2) needs each resource's own balance shown, not
  // one pooled number. A membership member viewing an away gym only sees
  // their network-credit balance here — that's genuinely the only type
  // spendable there, matching create_booking()'s own logic exactly, so a
  // member with none sees "0" and knows they need a top-up rather than
  // being shown a misleadingly higher total that includes home-only credit.
  const creditsByType: Record<string, number> = {};
  await Promise.all(
    Array.from(new Set(resources.map((r) => r.creditType))).map(async (creditType) => {
      creditsByType[creditType] =
        membership && !isHomeGymView
          ? await getCreditBalance(member.id, networkCreditType(creditType))
          : await getTotalCreditBalance(member.id, creditType);
    })
  );

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <BookingGrid
        key={`${viewGym}-${formatDateParam(selectedDate)}`}
        gym={viewGym}
        homeGym={member.gym}
        hasMembership={!!membership}
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
