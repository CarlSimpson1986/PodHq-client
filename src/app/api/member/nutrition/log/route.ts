import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { logFood } from "@/lib/coach/food-log";
import { logFoodSchema } from "@/lib/validation/nutrition";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/nutrition/log");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = logFoodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    await logFood(member.id, {
      meal: parsed.data.meal,
      foodName: parsed.data.foodName,
      brand: parsed.data.brand || null,
      quantityG: parsed.data.quantityG,
      caloriesPer100g: parsed.data.caloriesPer100g,
      proteinPer100g: parsed.data.proteinPer100g,
      carbsPer100g: parsed.data.carbsPer100g,
      fatPer100g: parsed.data.fatPer100g,
      source: parsed.data.source,
      loggedDate: parsed.data.loggedDate,
    });
  } catch (error) {
    console.error("[nutrition-log] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
