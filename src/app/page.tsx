import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getCreditBalance, getActiveMembership, getNextUpcomingBooking } from "@/lib/data/member";
import { NoMemberProfile } from "@/components/no-member-profile";
import { BottomNav } from "@/components/bottom-nav";

// Server Component, so this never re-runs client-side — no hydration risk
// — but still worth pinning: unpinned, this would show UTC wall-clock time
// (Vercel's serverless functions run in UTC internally) rather than the
// gym's actual London time.
function formatSlot(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/London" }) +
    " at " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
  );
}

export default async function HomePage() {
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

  const [credits, membership, upcomingBooking] = await Promise.all([
    getCreditBalance(member.id),
    getActiveMembership(member.id),
    getNextUpcomingBooking(member.id),
  ]);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">Hello, {member.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{member.gym}</p>
        </div>
      </div>

      <div className="card-light flex-1 space-y-4 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          {!membership && (
            <div className="rounded-xl border-2 border-card-light-foreground p-5">
              <p className="text-base font-semibold">Get Your Membership</p>
              <p className="mt-1 text-sm text-card-light-muted">Get started with a monthly credit allowance.</p>
              <Link
                href="/buy-membership"
                className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Get Membership
              </Link>
            </div>
          )}

          <div className="rounded-xl border border-card-light-border p-5 text-center">
            {upcomingBooking ? (
              <>
                <p className="text-base font-semibold">Upcoming session</p>
                <p className="mt-1 text-sm text-card-light-muted">{formatSlot(upcomingBooking.slot_start)}</p>
                <Link
                  href="/bookings"
                  className="mt-3 inline-block rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
                >
                  Access
                </Link>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">No upcoming sessions</p>
                <p className="mt-1 text-sm text-card-light-muted">Book a session to set your goals in motion.</p>
                <Link
                  href="/book"
                  className="mt-3 inline-block rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
                >
                  Book Session
                </Link>
              </>
            )}
          </div>

          <p className="text-center text-sm text-card-light-muted">{credits} credits available</p>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
