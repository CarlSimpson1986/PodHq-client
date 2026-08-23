import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getFoodLogEntryOwnerMemberId, deleteFoodLogEntry } from "@/lib/coach/food-log";
import { checkRateLimit } from "@/lib/rate-limit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/nutrition/log-delete");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ status: "error", message: "Invalid entry." }, { status: 400 });
  }

  try {
    const ownerMemberId = await getFoodLogEntryOwnerMemberId(entryId);
    if (ownerMemberId === null || ownerMemberId !== member.id) {
      return NextResponse.json({ status: "error", message: "Entry not found." }, { status: 404 });
    }
    await deleteFoodLogEntry(entryId);
  } catch (error) {
    console.error("[nutrition-log-delete] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
