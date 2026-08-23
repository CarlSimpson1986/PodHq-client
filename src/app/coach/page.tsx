import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership, getNextUpcomingBooking } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getCoachHomeState } from "@/lib/coach/trial-state";
import { getLastCheckIn } from "@/lib/coach/check-ins";
import { getCheckInDueState } from "@/lib/coach/checkin-state";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { CoachBottomNav } from "@/components/coach-bottom-nav";
import { TrialBanner } from "@/components/trial-banner";
import { SparkleIcon } from "@/components/icons";
import { SectionHeading, ComingSoonCard } from "@/components/coach-section";

// The Coach section's Dashboard tab — deliberately slim (Stage 10a
// stacked Workouts/Nutrition here too as sections on one long page; Carl
// asked for a real dedicated nav instead once check-in and habits were
// going to add actual content on top of that, not just placeholder
// cards, matching how content-heavy areas in apps like Strava/Whoop/
// MyFitnessPal get their own tab bar rather than one long scrolling
// page). Workouts and Nutrition now live at /coach/workout and
// /coach/nutrition, reached via CoachBottomNav, not duplicated here.
export default async function CoachPage() {
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

  const [membership, coachProfile, upcomingBooking] = await Promise.all([
    getActiveMembership(member.id),
    getCoachProfile(member.id),
    getNextUpcomingBooking(member.id),
  ]);

  const state = getCoachHomeState(member, membership);
  const lastCheckIn = coachProfile ? await getLastCheckIn(member.id) : null;
  const checkInState = getCheckInDueState(coachProfile, lastCheckIn, new Date());

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Coach" subtitle="Your AI Coach dashboard" icon={SparkleIcon} iconHref="/profile" />
      <div className="card-light flex-1 space-y-8 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-8">
          {state.kind === "no_trial" && <TrialBanner />}

          {state.kind === "trial_pending" && (
            <div className="rounded-xl border border-card-light-border p-5">
              <p className="text-sm font-semibold">AI Coach trial ready</p>
              <p className="mt-1 text-sm text-card-light-muted">
                Book your next session and your 7-day trial starts automatically.
              </p>
              <Link href="/book" className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white">
                Book a session
              </Link>
            </div>
          )}

          {state.kind === "trial_expired" && (
            <div className="rounded-xl border border-card-light-border p-5">
              <p className="text-sm font-semibold">Your trial has ended.</p>
              <p className="mt-1 text-sm text-card-light-muted">Upgrade to keep your AI Coach ready every session.</p>
              <Link
                href="/buy-membership"
                className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white"
              >
                Upgrade
              </Link>
            </div>
          )}

          {(state.kind === "trial_active" || state.kind === "subscriber") && (
            <>
              <section>
                <SectionHeading>Today</SectionHeading>
                <div className="rounded-xl border border-card-light-border p-5">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      state.kind === "trial_active" ? "text-warning" : "text-success"
                    }`}
                  >
                    {state.kind === "trial_active"
                      ? `AI Coach · Trial · ${state.daysRemaining} ${state.daysRemaining === 1 ? "day" : "days"} remaining`
                      : `${state.tierName} member`}
                  </p>

                  {!coachProfile ? (
                    <>
                      <p className="mt-2 text-sm text-card-light-muted">Answer a few quick questions to set up your AI Coach.</p>
                      <Link
                        href="/coach-onboarding"
                        className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white"
                      >
                        Set up my AI Coach
                      </Link>
                    </>
                  ) : upcomingBooking ? (
                    <>
                      <p className="mt-2 text-sm text-card-light-muted">Your personalised workout is ready.</p>
                      <Link
                        href={`/workout/${upcomingBooking.id}`}
                        className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white"
                      >
                        View my workout
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-card-light-muted">Book a session to get your next personalised workout.</p>
                      <Link href="/book" className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white">
                        Book a session
                      </Link>
                    </>
                  )}
                </div>
              </section>

              {coachProfile && (
                <section>
                  <SectionHeading>Check-in</SectionHeading>
                  <Link href="/coach/checkin" className="block rounded-xl border border-card-light-border p-5">
                    {checkInState.kind === "not_due" && (
                      <>
                        <p className="text-sm font-semibold">
                          {checkInState.daysRemaining} {checkInState.daysRemaining === 1 ? "day" : "days"} to your next check-in
                        </p>
                        <p className="mt-1 text-sm text-card-light-muted">Due {checkInState.nextDueDate}.</p>
                      </>
                    )}
                    {checkInState.kind === "due" && (
                      <>
                        <p className="text-sm font-semibold text-warning">Check-in ready</p>
                        <p className="mt-1 text-sm text-card-light-muted">See how your week went →</p>
                      </>
                    )}
                    {checkInState.kind === "overdue" && (
                      <>
                        <p className="text-sm font-semibold text-danger">
                          Check-in overdue by {checkInState.daysOverdue} {checkInState.daysOverdue === 1 ? "day" : "days"}
                        </p>
                        <p className="mt-1 text-sm text-card-light-muted">See how your week went →</p>
                      </>
                    )}
                  </Link>
                </section>
              )}

              {coachProfile && (
                <section>
                  <SectionHeading>Habits</SectionHeading>
                  <ComingSoonCard title="Habit tracker" body="Track the habits you know you're bad at — coming soon." />
                </section>
              )}

              <section>
                <SectionHeading>Coming soon</SectionHeading>
                <div className="space-y-4">
                  <ComingSoonCard
                    title="Tech integrations"
                    body="HRV, resting pulse, sleep, and steps need the native app (Apple Health / Google Health Connect aren't accessible from this web app) — coming with a future update."
                  />
                  <ComingSoonCard title="Challenges" body="Community challenges are coming soon." />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <CoachBottomNav />
    </main>
  );
}
