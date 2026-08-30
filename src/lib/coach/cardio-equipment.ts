import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonDateString } from "@/lib/london-time";

export interface CardioEquipment {
  id: number;
  name: string;
}

// Reads gym_cardio_equipment directly — a podHq-owned table (named via
// /setup), same cross-app shared-table pattern already used for
// pod_resources.equipment (both apps sit on one Supabase project, no
// HTTP bridge between them). Enabled-only, matches what podHq's own
// getEnabledCardioEquipment offers.
export async function getEnabledCardioEquipmentForGym(gym: string): Promise<CardioEquipment[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("gym_cardio_equipment").select("id, name").eq("gym", gym).eq("enabled", true).order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// IDOR guard — never trust a client-supplied equipment id alone, same
// posture as getHabitOwnerMemberId. Also confirms the equipment is still
// enabled and belongs to the member's own gym, not just that the row
// exists somewhere.
export async function getCardioEquipmentGym(equipmentId: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("gym_cardio_equipment").select("gym").eq("id", equipmentId).eq("enabled", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.gym ?? null;
}

// Insert-only ticks, same convention as habit_logs — one row per log, no
// stored completion flag. A member can log more than one machine/session
// per day; "done today" is just count(*) for (member_id, log_date) > 0.
export async function logCardioEquipmentUse(memberId: number, equipmentId: number, date: string = londonDateString(new Date())): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_cardio_logs").insert({ member_id: memberId, equipment_id: equipmentId, log_date: date });
  if (error) throw new Error(error.message);
}

export async function getTodayCardioLogCount(memberId: number, date: string = londonDateString(new Date())): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("member_cardio_logs")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("log_date", date);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
