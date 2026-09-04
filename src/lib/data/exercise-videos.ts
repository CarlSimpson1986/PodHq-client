import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "exercise-videos";

// Cross-app read, same pattern as stripe-config.ts — podHq owns the admin
// upload UI (src/app/(app)/exercise-videos in that repo) that writes
// exercise_video_overrides, this app only ever reads it. Public bucket, so
// the URL is deterministic from the stored path, no signed read needed.
export async function getExerciseVideoOverrideMap(): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("exercise_video_overrides").select("exercise_key, video_path");
  if (error) throw error;

  const base = process.env.SUPABASE_URL;
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.exercise_key] = `${base}/storage/v1/object/public/${BUCKET}/${row.video_path}`;
  }
  return map;
}
