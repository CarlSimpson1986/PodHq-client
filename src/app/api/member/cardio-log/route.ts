import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCardioEquipmentGym, logCardioEquipmentUse } from "@/lib/coach/cardio-equipment";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/cardio-log");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const equipmentId = Number(body?.equipmentId);
  if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
    return NextResponse.json({ status: "error", message: "Invalid equipment." }, { status: 400 });
  }

  try {
    // Never trust a client-supplied equipment id alone — same IDOR
    // posture as getHabitOwnerMemberId. Also confirms it's still enabled
    // and belongs to the member's own gym, not just that the row exists
    // somewhere.
    const equipmentGym = await getCardioEquipmentGym(equipmentId);
    if (equipmentGym === null || equipmentGym !== member.gym) {
      return NextResponse.json({ status: "error", message: "Equipment not found." }, { status: 404 });
    }

    await logCardioEquipmentUse(member.id, equipmentId);
  } catch (error) {
    console.error("[cardio-log] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
