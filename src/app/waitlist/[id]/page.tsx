import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getWaitlistEntryForMember } from "@/lib/waitlist/get-entry";
import { PageHero } from "@/components/page-hero";
import { CalendarIcon } from "@/components/icons";
import { WaitlistOfferView } from "@/components/waitlist-offer-view";

export default async function WaitlistOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id: idParam } = await params;
  const id = Number(idParam);

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-danger">No member profile found for this account.</p>
      </main>
    );
  }

  const entry = Number.isInteger(id) && id > 0 ? await getWaitlistEntryForMember(id, member.id) : null;

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Waitlist offer" subtitle="A spot opened up" icon={CalendarIcon} iconHref="/profile" />
      <div className="card-light flex-1 px-6 pb-24 pt-8">
        <div className="mx-auto w-full max-w-md">
          <WaitlistOfferView entry={entry} />
        </div>
      </div>
    </main>
  );
}
