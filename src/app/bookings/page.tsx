import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getAllMemberBookings, getPodResourcesForGym, getPodResourcesByIds, isAccessComplete } from "@/lib/data/member";
import { PageHero } from "@/components/page-hero";
import { CalendarIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { BookingsView } from "@/components/bookings-view";

export default async function BookingsPage() {
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

  const [bookings, homeResources] = await Promise.all([
    getAllMemberBookings(member.id),
    getPodResourcesForGym(member.gym),
  ]);
  // Cross-gym bookings' resources aren't in the home gym's list — without
  // them those bookings fall back to a 60-minute window and lose their
  // door setup (e.g. Hove's main door).
  const missingIds = [...new Set(bookings.map((b) => b.resource_id))].filter((id) => !homeResources.some((r) => r.id === id));
  const resources = [...homeResources, ...(await getPodResourcesByIds(missingIds))];

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Bookings" subtitle="Your upcoming and past sessions." icon={CalendarIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <BookingsView bookings={bookings} accessComplete={isAccessComplete(member)} resources={resources} />
        </div>
      </div>
    </main>
  );
}
