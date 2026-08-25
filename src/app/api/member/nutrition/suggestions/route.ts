import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets } from "@/lib/coach/nutrition-targets";
import { getDayLog } from "@/lib/coach/food-log";
import { getMealSuggestions } from "@/lib/coach/meal-suggestions";
import { checkRateLimit } from "@/lib/rate-limit";
import { dayLogQuerySchema } from "@/lib/validation/nutrition";
import { londonDateString } from "@/lib/london-time";

const SUGGESTIONS_LIMIT_PER_MINUTE = 20;

export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/nutrition/suggestions", SUGGESTIONS_LIMIT_PER_MINUTE);
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const parsed = dayLogQuerySchema.safeParse({ date: request.nextUrl.searchParams.get("date") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid date." }, { status: 400 });
  }
  const date = parsed.data.date ?? londonDateString(new Date());

  const coachProfile = await getCoachProfile(member.id);
  const targets = coachProfile ? computeNutritionTargets(coachProfile, member.gender) : null;
  if (!targets) {
    return NextResponse.json({ status: "ok", suggestions: [], trackingMode: coachProfile?.nutrition_tracking_mode ?? "calorie_counting" });
  }

  try {
    const { entries, totals } = await getDayLog(member.id, date);
    const remaining = {
      calories: targets.calories - totals.calories,
      proteinG: targets.proteinG - totals.proteinG,
      carbsG: targets.carbsG - totals.carbsG,
      fatG: targets.fatG - totals.fatG,
    };
    const loggedMeals = [...new Set(entries.map((e) => e.meal))];
    const suggestions = getMealSuggestions(remaining, loggedMeals);
    return NextResponse.json({ status: "ok", suggestions, remaining, trackingMode: coachProfile!.nutrition_tracking_mode });
  } catch (error) {
    console.error("[nutrition-suggestions] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
