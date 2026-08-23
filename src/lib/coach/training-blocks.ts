import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActiveBlock } from "@/lib/coach/training-block-state";
import type { BlockType } from "@/lib/coach/types";

// Most-recent-first, matching getActiveBlock's expected ordering.
export async function getBlockHistory(memberId: number): Promise<ActiveBlock[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("training_blocks")
    .select("block_type, started_at")
    .eq("member_id", memberId)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ blockType: row.block_type as BlockType, startedAt: row.started_at }));
}

// Insert-only, no update/delete — a block transition is a fact, not a
// mutable status, same "row existence = happened" convention as
// check_ins/food_log_entries/habit_logs.
export async function startBlock(memberId: number, blockType: BlockType): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("training_blocks").insert({ member_id: memberId, block_type: blockType });
  if (error) throw new Error(error.message);
}
