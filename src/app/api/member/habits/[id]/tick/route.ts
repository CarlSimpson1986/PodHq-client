import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getHabitOwnerMemberId, logHabitTick, getTodayProgress } from "@/lib/coach/daily-habits";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/habits-tick");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const { id } = await params;
  const habitId = Number(id);
  if (!Number.isInteger(habitId) || habitId <= 0) {
    return NextResponse.json({ status: "error", message: "Invalid habit." }, { status: 400 });
  }

  try {
    const ownerMemberId = await getHabitOwnerMemberId(habitId);
    if (ownerMemberId === null || ownerMemberId !== member.id) {
      return NextResponse.json({ status: "error", message: "Habit not found." }, { status: 404 });
    }

    // Checkbox habits are idempotent — never a second tick for the same
    // day, checked here rather than a DB constraint (a duplicate row
    // would be harmless — see daily-habits.ts — but there's no reason to
    // ever create one). Counted habits have no such cap; every tap is a
    // genuine new tick.
    const admin = createAdminClient();
    const { data: habit, error: habitError } = await admin.from("member_habits").select("habit_type").eq("id", habitId).single();
    if (habitError) throw new Error(habitError.message);

    if (habit.habit_type === "checkbox") {
      const progress = await getTodayProgress(member.id);
      if ((progress.get(habitId) ?? 0) > 0) {
        return NextResponse.json({ status: "ok", alreadyDone: true });
      }
    }

    await logHabitTick(member.id, habitId);
  } catch (error) {
    console.error("[habits-tick] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
