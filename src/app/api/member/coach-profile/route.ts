import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Trial clock starts here, not on first booking (2026-09-03, Carl:
  // onboarding now hands straight off to Pod Coach on the Dashboard, so
  // the trial should be live from that moment — gated the same way
  // (trial_activated_at set, trial_started_at still null) so it only
  // ever fires once, but the trigger is "finished setup" rather than
  // "booked a session," since a member without a completed profile has
  // nothing for Pod Coach to actually run yet.
  //
  // Privacy Policy consent also stamps here now, not on first tap into
  // the Coach bubble — the schema already requires agreedToPrivacy to be
  // true to reach this point, so this just records it. hasAcceptedPrivacyPolicy()
  // (member.ts) reads this same column, so PrivacyConsentForm simply never
  // renders for anyone who completed onboarding through this route.
  const memberUpdate: Record<string, string> = { privacy_policy_accepted_at: new Date().toISOString() };
  if (member.trial_activated_at && !member.trial_started_at) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    memberUpdate.trial_started_at = now.toISOString();
    memberUpdate.trial_expires_at = expiresAt.toISOString();
  }
  const admin = createAdminClient();
  const { error: memberUpdateError } = await admin.from("members").update(memberUpdate).eq("id", member.id);
  if (memberUpdateError) {
    console.error("[coach-profile] failed to update member trial/consent state", { error: memberUpdateError.message });
  }

  return NextResponse.json({ status: "ok" });
}
