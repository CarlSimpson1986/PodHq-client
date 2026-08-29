import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getHabitOwnerMemberId, undoLastTickToday } from "@/lib/coach/daily-habits";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/habits-untick");
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
    const undone = await undoLastTickToday(member.id, habitId);
    return NextResponse.json({ status: "ok", undone });
  } catch (error) {
    console.error("[habits-untick] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
