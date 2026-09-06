import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXERCISE_CATALOG } from "@/lib/coach/exercise-catalog";

// Persistent "never suggest this again" exclusion (2026-09-06,
// member_avoided_exercises) — a member's own durable choice, independent
// of the injuries free-text field, keyed on the exact catalog key rather
// than a fuzzy substring match. Same admin-client-only-writes, select-only-
// RLS convention as member_workout_manual_logs.

export async function getAvoidedExerciseKeys(memberId: number): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("member_avoided_exercises").select("exercise_key").eq("member_id", memberId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.exercise_key);
}

// (member_id, exercise_key) is unique, so re-avoiding an already-avoided
// exercise is a harmless no-op rather than an error — same idempotency
// posture as habit_logs/member_workout_manual_logs.
export async function avoidExercise(memberId: number, exerciseKey: string, reason: string | null = null): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("member_avoided_exercises")
    .upsert({ member_id: memberId, exercise_key: exerciseKey, reason }, { onConflict: "member_id,exercise_key" });
  if (error) throw new Error(error.message);
}

// "Un-avoid" — a plain delete, not a soft-archive: this is a durable
// preference a member can freely reconsider, not a log of something that
// happened.
export async function unavoidExercise(memberId: number, exerciseKey: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_avoided_exercises").delete().eq("member_id", memberId).eq("exercise_key", exerciseKey);
  if (error) throw new Error(error.message);
}

export interface AvoidedExercise {
  key: string;
  name: string;
}

// For the Coach-settings management list — joins against the catalog
// in-memory rather than a DB join, same lookup-by-key pattern as the rest
// of this codebase's catalog helpers. A key no longer in the catalog
// (shouldn't happen — nothing removes catalog entries) is skipped rather
// than shown with a broken name.
export async function getAvoidedExercisesWithNames(memberId: number): Promise<AvoidedExercise[]> {
  const keys = await getAvoidedExerciseKeys(memberId);
  const byKey = new Map(EXERCISE_CATALOG.map((e) => [e.key, e.name]));
  return keys.map((key) => ({ key, name: byKey.get(key) })).filter((e): e is AvoidedExercise => e.name !== undefined);
}
