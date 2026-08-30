import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateProfileWeightKg } from "@/lib/coach/coach-profile";

const WEEKS_WINDOW = 26;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BodyMeasurementPoint {
  recordedDate: string;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

// Weekly weigh-in (2026-08-30) — logged as part of the check-in, one row
// per calendar day (upsert on member_id+recorded_date, so a member
// re-submitting the same day's check-in never creates a duplicate
// point). Every field is optional — a member can log any subset (just
// weight, just waist, whatever they have to hand); a call with nothing
// supplied is a no-op rather than writing an all-null row. Only weightKg
// syncs back into coach_profiles.weight_kg — waist/hip have nowhere else
// to live and aren't used in any calculation, so there's nothing to sync
// for them.
export async function logBodyMeasurements(
  memberId: number,
  recordedDate: string,
  values: { weightKg?: number; waistCm?: number; hipCm?: number }
): Promise<void> {
  if (values.weightKg === undefined && values.waistCm === undefined && values.hipCm === undefined) return;

  const admin = createAdminClient();
  const { error } = await admin.from("member_body_measurements").upsert(
    {
      member_id: memberId,
      recorded_date: recordedDate,
      weight_kg: values.weightKg ?? null,
      waist_cm: values.waistCm ?? null,
      hip_cm: values.hipCm ?? null,
    },
    { onConflict: "member_id,recorded_date" }
  );
  if (error) throw new Error(error.message);

  if (values.weightKg !== undefined) {
    await updateProfileWeightKg(memberId, values.weightKg);
  }
}

// Feeds the trend charts on /coach/profile (body-measurement-trends.tsx)
// — same WEEKS_WINDOW-bounded plain date-range query shape as
// consistency.ts/exercise-performance.ts. Ordered oldest-first so the
// chart can render left-to-right without re-sorting.
export async function getBodyMeasurementHistory(memberId: number): Promise<BodyMeasurementPoint[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WEEKS_WINDOW * 7 * MS_PER_DAY);

  const { data, error } = await admin
    .from("member_body_measurements")
    .select("recorded_date, weight_kg, waist_cm, hip_cm")
    .eq("member_id", memberId)
    .gte("recorded_date", since.toISOString().slice(0, 10))
    .order("recorded_date", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    recordedDate: row.recorded_date,
    weightKg: row.weight_kg,
    waistCm: row.waist_cm,
    hipCm: row.hip_cm,
  }));
}
