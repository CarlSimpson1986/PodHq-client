import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getHabitOwnerMemberId, archiveHabit } from "@/lib/coach/daily-habits";
import { checkRateLimit } from "@/lib/rate-limit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/habits-delete");
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
    await archiveHabit(habitId);
  } catch (error) {
    console.error("[habits-archive] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
