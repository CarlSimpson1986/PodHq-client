import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getCreditBalance, getTodaysBookings } from "@/lib/data/member";
import { BookingGrid } from "@/components/booking-grid";

export default async function BookPage() {
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

  const [credits, todaysBookings] = await Promise.all([
    getCreditBalance(member.id),
    getTodaysBookings(member.gym),
  ]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-12">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{member.gym}</h1>
          <p className="text-sm text-muted-foreground">Hi {member.name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-accent">{credits}</p>
          <p className="text-xs text-muted-foreground">credits</p>
        </div>
      </header>

      <BookingGrid gym={member.gym} memberId={member.id} initialBookings={todaysBookings} />
    </main>
  );
}
