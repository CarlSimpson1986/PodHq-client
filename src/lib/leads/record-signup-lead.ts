import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

interface RecordSignupLeadInput {
  memberId: number;
  gym: string;
  name: string;
  email: string;
}

/**
 * Auto-populates podHq's leads pipeline on a genuinely new signup — "new
 * user = lead," the same model GymFlow itself uses (a lead is just someone
 * who downloaded the app), just automated here instead of relying on a
 * manually-exported CSV. Writes into podHq's own `leads` table via the
 * shared admin client — same cross-repo pattern already established in
 * staff-recipients.ts/resolve-member-contact.ts (same Postgres database,
 * no restriction).
 *
 * `lead_source_id` is synthetic (`app:${memberId}`) so this satisfies the
 * table's existing (gym, lead_source_id) unique index without a schema
 * change, and stays namespace-disjoint from GymFlow's own CSV Lead IDs.
 *
 * Never throws — a signup must succeed even if this insert fails. 23505
 * (duplicate, e.g. a retried request) is an expected no-op, not a logged
 * failure. No separate audit table: unlike an email send, this has no
 * external API and no per-recipient outcome worth auditing — its only
 * failure modes already show up in server logs.
 */
export async function recordSignupLead(input: RecordSignupLeadInput): Promise<void> {
  const spaceIndex = input.name.indexOf(" ");
  const firstName = spaceIndex === -1 ? input.name : input.name.slice(0, spaceIndex);
  const lastName = spaceIndex === -1 ? "" : input.name.slice(spaceIndex + 1);

  const admin = createAdminClient();
  const { error } = await admin.from("leads").insert({
    gym: input.gym,
    lead_source_id: `app:${input.memberId}`,
    first_name: firstName,
    last_name: lastName,
    email: input.email,
    created_date: new Date().toISOString(),
    member_id: input.memberId,
  });

  if (error && error.code !== "23505") {
    console.error("[leads] failed to record signup lead", { memberId: input.memberId, error: error.message });
  }
}
