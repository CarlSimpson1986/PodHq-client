import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WaitlistEntry } from "./types";

export async function getWaitlistEntryForMember(id: number, memberId: number): Promise<WaitlistEntry | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("waitlist_entries").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.member_id !== memberId) return null;
  return data as WaitlistEntry;
}
