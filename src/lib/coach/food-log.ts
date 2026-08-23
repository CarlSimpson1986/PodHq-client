import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonDateString } from "@/lib/london-time";
import type { Meal, FoodLogSource } from "@/lib/coach/types";

export interface FoodLogEntry {
  id: number;
  loggedDate: string;
  meal: Meal;
  foodName: string;
  brand: string | null;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: FoodLogSource;
}

export interface LogFoodInput {
  meal: Meal;
  foodName: string;
  brand: string | null;
  quantityG: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: FoodLogSource;
  loggedDate?: string;
}

function scaleToQuantity(per100g: number, quantityG: number): number {
  return Math.round(((per100g * quantityG) / 100) * 10) / 10;
}

export async function logFood(memberId: number, input: LogFoodInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("food_log_entries").insert({
    member_id: memberId,
    logged_date: input.loggedDate ?? londonDateString(new Date()),
    meal: input.meal,
    food_name: input.foodName,
    brand: input.brand,
    quantity_g: input.quantityG,
    calories: scaleToQuantity(input.caloriesPer100g, input.quantityG),
    protein_g: scaleToQuantity(input.proteinPer100g, input.quantityG),
    carbs_g: scaleToQuantity(input.carbsPer100g, input.quantityG),
    fat_g: scaleToQuantity(input.fatPer100g, input.quantityG),
    source: input.source,
  });

  if (error) throw new Error(error.message);
}

// Used by the DELETE route's IDOR guard — never trust a client-supplied
// entry id alone, same pattern as getSessionOwnerMemberId for workouts.
export async function getFoodLogEntryOwnerMemberId(entryId: number): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("food_log_entries").select("member_id").eq("id", entryId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.member_id ?? null;
}

export async function deleteFoodLogEntry(entryId: number): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("food_log_entries").delete().eq("id", entryId);
  if (error) throw new Error(error.message);
}

export interface DayTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export async function getDayLog(memberId: number, date: string): Promise<{ entries: FoodLogEntry[]; totals: DayTotals }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("food_log_entries")
    .select("id, logged_date, meal, food_name, brand, quantity_g, calories, protein_g, carbs_g, fat_g, source")
    .eq("member_id", memberId)
    .eq("logged_date", date)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const entries: FoodLogEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    loggedDate: row.logged_date,
    meal: row.meal as Meal,
    foodName: row.food_name,
    brand: row.brand,
    quantityG: row.quantity_g,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    source: row.source as FoodLogSource,
  }));

  const totals = entries.reduce<DayTotals>(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  return { entries, totals };
}

export interface RecentFood {
  foodName: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: FoodLogSource;
}

// Distinct foods the member has logged recently, most-recent first — the
// "+ Add food" sheet's default tab, so re-logging a common item is one
// tap instead of a search every time. Reconstructs per-100g values from
// the stored (already-scaled) entry using its own quantity, so a quick-add
// re-log can be scaled to a fresh quantity rather than always repeating
// the exact same amount.
export async function getRecentFoods(memberId: number, limit = 10): Promise<RecentFood[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("food_log_entries")
    .select("food_name, brand, quantity_g, calories, protein_g, carbs_g, fat_g, source, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const recent: RecentFood[] = [];
  for (const row of data ?? []) {
    const key = `${row.food_name}|${row.brand ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const factor = row.quantity_g > 0 ? 100 / row.quantity_g : 0;
    recent.push({
      foodName: row.food_name,
      brand: row.brand,
      caloriesPer100g: Math.round(row.calories * factor * 10) / 10,
      proteinPer100g: Math.round(row.protein_g * factor * 10) / 10,
      carbsPer100g: Math.round(row.carbs_g * factor * 10) / 10,
      fatPer100g: Math.round(row.fat_g * factor * 10) / 10,
      source: row.source as FoodLogSource,
    });
    if (recent.length >= limit) break;
  }

  return recent;
}
