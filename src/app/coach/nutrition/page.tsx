import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { computeNutritionTargets } from "@/lib/coach/nutrition-targets";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { BottomNav } from "@/components/bottom-nav";
import { AppleIcon } from "@/components/icons";

// Stage 6 — targets only, no logging yet (that's Stage 7). Same
// hasPremium + coachProfile gate as /workout/[bookingId], since targets
// are computed from the coach profile and aren't useful without one.
export default async function NutritionPage() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return <NoMemberProfile />;
  }

  if (!(await hasPremium(member))) {
    redirect("/coach");
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    redirect("/coach-onboarding");
  }

  const targets = computeNutritionTargets(coachProfile, member.gender);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Nutrition" subtitle="Your daily targets" icon={AppleIcon} iconHref="/profile" />
      <div className="card-light flex-1 space-y-6 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          {!targets ? (
            <div className="rounded-xl border border-card-light-border p-5">
              <p className="text-sm font-semibold">Body stats needed</p>
              <p className="mt-1 text-sm text-card-light-muted">
                Your weight, height and age from onboarding are needed to work out your daily targets.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-card-light-border p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Daily calorie target</p>
                <p className="mt-1 text-3xl font-semibold">{targets.calories.toLocaleString("en-GB")} kcal</p>
                <p className="mt-2 text-sm text-card-light-muted">
                  Based on your body stats, weekly sessions, and goal — recalculates automatically if any of those change.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MacroCard label="Protein" grams={targets.proteinG} />
                <MacroCard label="Carbs" grams={targets.carbsG} />
                <MacroCard label="Fat" grams={targets.fatG} />
              </div>

              <div className="rounded-xl border border-dashed border-card-light-border p-5 opacity-70">
                <p className="text-sm font-semibold">Meal logging</p>
                <p className="mt-1 text-sm text-card-light-muted">
                  Search and log what you eat against these targets — coming soon.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function MacroCard({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="rounded-xl border border-card-light-border p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{grams}g</p>
    </div>
  );
}
