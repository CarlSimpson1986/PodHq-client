import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { PageHero } from "@/components/page-hero";
import { PinIcon } from "@/components/icons";
import { NoMemberProfile } from "@/components/no-member-profile";
import { AccessAddressForm } from "@/components/access-address-form";

export default async function AccessAddressPage() {
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
      <PageHero title="Access — Step 2 of 3" subtitle="Your home address." icon={PinIcon} iconHref="/profile" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <AccessAddressForm
            initialLine1={member.address_line1 ?? ""}
            initialLine2={member.address_line2 ?? ""}
            initialCity={member.address_city ?? ""}
            initialPostcode={member.address_postcode ?? ""}
          />
        </div>
      </div>
    </main>
  );
}
