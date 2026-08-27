import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getAllMemberBookings, getPodResourcesForGym, isAccessComplete } from "@/lib/data/member";
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

  const [bookings, resources] = await Promise.all([
    getAllMemberBookings(member.id),
    getPodResourcesForGym(member.gym),
  ]);

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
