import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
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

  return <ProfileView memberName={member.name} gym={member.gym} membership={membership} />;
}
