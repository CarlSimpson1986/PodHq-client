import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { createCoachProfile } from "@/lib/coach/coach-profile";
import { coachProfileSchema } from "@/lib/validation/coach-profile";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/coach-profile");
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

  const parsed = coachProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    await createCoachProfile(member.id, {
      goal: parsed.data.goal,
      experienceLevel: parsed.data.experienceLevel,
      injuries: parsed.data.injuries || null,
      sessionsPerWeek: parsed.data.sessionsPerWeek,
      weightKg: parsed.data.weightKg,
      heightCm: parsed.data.heightCm,
      age: parsed.data.age,
      dailyActivityLevel: parsed.data.dailyActivityLevel,
      mealCountPreference: parsed.data.mealCountPreference ?? null,
      foodAllergies: parsed.data.foodAllergies || null,
      foodPreferences: parsed.data.foodPreferences ?? null,
      nutritionTrackingMode: parsed.data.nutritionTrackingMode ?? "calorie_counting",
    });
  } catch (error) {
    console.error("[coach-profile] failed to save", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
