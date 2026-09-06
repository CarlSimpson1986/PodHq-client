import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReadinessLevel } from "@/lib/coach/types";

export interface ReadinessCheckAnswers {
  sleepQuality: ReadinessLevel;
  soreness: ReadinessLevel;
  energy: ReadinessLevel;
}

export async function getReadinessCheck(sessionId: number): Promise<ReadinessCheckAnswers | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workout_readiness_checks")
    .select("sleep_quality, soreness, energy")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { sleepQuality: data.sleep_quality, soreness: data.soreness, energy: data.energy };
}

// Upsert on session_id, not insert-only — a member can correct their
// answer before the session actually starts (same idiom body-measurements'
// same-day upsert uses), but there is nothing to correct once a set has
// been logged (the route guards on hasProgress, same as applyRecoveryAdjustment).
export async function logReadinessCheck(sessionId: number, memberId: number, answers: ReadinessCheckAnswers): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("workout_readiness_checks").upsert(
    {
      session_id: sessionId,
      member_id: memberId,
      sleep_quality: answers.sleepQuality,
      soreness: answers.soreness,
      energy: answers.energy,
    },
    { onConflict: "session_id" }
  );
  if (error) throw new Error(error.message);
}
