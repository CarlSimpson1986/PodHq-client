import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership, isAccessComplete } from "@/lib/data/member";
import { ProfileView } from "@/components/profile-view";
import { NoMemberProfile } from "@/components/no-member-profile";

export default async function ProfilePage() {
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

  const membership = await getActiveMembership(member.id);

  return (
    <ProfileView
      memberName={member.name}
      email={user.email ?? null}
      gym={member.gym}
      mobileNumber={member.mobile_number}
      gender={member.gender}
      addressLine1={member.address_line1}
      addressLine2={member.address_line2}
      addressCity={member.address_city}
      addressPostcode={member.address_postcode}
      waiverSignedAt={member.waiver_signed_at}
      membership={membership}
      accessComplete={isAccessComplete(member)}
    />
  );
}
