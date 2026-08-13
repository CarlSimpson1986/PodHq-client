import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MemberContact {
  email: string;
  name: string;
  gym: string;
}

/**
 * The Stripe webhook route has no session client and no email/gym in scope
 * anywhere — metadata only ever carries member_id and numeric fields. Every
 * webhook handler that needs to email a member goes through this one
 * shared join (members -> auth_user_id -> auth.users) instead of repeating
 * it inline at each of the four call sites. Returns null (and logs) rather
 * than throwing — a missing email must never fail the underlying
 * credit/membership write that already succeeded.
 */
export async function resolveMemberContact(memberId: number): Promise<MemberContact | null> {
  const admin = createAdminClient();

  const { data: member, error: memberError } = await admin
    .from("members")
    .select("auth_user_id, name, gym")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    console.error("[notifications] failed to resolve member for contact lookup", {
      memberId,
      error: memberError?.message,
    });
    return null;
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(member.auth_user_id);
  if (authError || !authUser.user?.email) {
    console.error("[notifications] failed to resolve auth email for member", {
      memberId,
      error: authError?.message,
    });
    return null;
  }

  return { email: authUser.user.email, name: member.name, gym: member.gym };
}
