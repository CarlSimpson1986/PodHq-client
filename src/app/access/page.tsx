import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { PageHero } from "@/components/page-hero";
import { LockIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { AccessContactForm } from "@/components/access-contact-form";

export default async function AccessContactPage() {
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
      <PageHero title="Access — Step 1 of 3" subtitle="Your contact details." icon={LockIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <AccessContactForm initialMobileNumber={member.mobile_number ?? ""} initialGender={member.gender ?? ""} />
        </div>
      </div>
    </main>
  );
}
