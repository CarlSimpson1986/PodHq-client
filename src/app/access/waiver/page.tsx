import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { PageHero } from "@/components/page-hero";
import { IdCardIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { AccessWaiverForm } from "@/components/access-waiver-form";

export default async function AccessWaiverPage() {
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

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Access — Step 3 of 3" subtitle="Sign the waiver and agreement." icon={IdCardIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <AccessWaiverForm initialSignedName={member.waiver_signed_name ?? member.name} />
        </div>
      </div>
    </main>
  );
}
