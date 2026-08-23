import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership, getNextUpcomingBooking } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getRecentCompletedSessions } from "@/lib/coach/workout-session";
import { getCoachHomeState } from "@/lib/coach/trial-state";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { BottomNav } from "@/components/bottom-nav";
import { TrialBanner } from "@/components/trial-banner";
import { SparkleIcon } from "@/components/icons";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

// The dashboard shell (Stage 10a) — named sections (Today, Check-in,
// Workouts, Nutrition, Habits) over the exact same data the page already
// fetched pre-restructure, no new queries. Check-in and Habits are honest
// placeholders until Stage 10b/11 ship real content into them, same
// "coming soon, not faked" posture as every other placeholder here. See
// ROADMAP.md's "Hove AI Coach — Nutrition, Leaderboard & Challenges"
// entries for the fuller history (Stage 5 built the original single-card
// hub; this splits it into a real dashboard after Carl asked for more
// structure and was talked out of a second bottom nav bar in favour of
// this).
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
  const recentSessions = coachProfile ? await getRecentCompletedSessions(member.id) : [];

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Coach" subtitle="Your AI Coach hub" icon={SparkleIcon} iconHref="/profile" />
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
                  <ComingSoonCard
                    title="Weekly check-in"
                    body="A weekly review of your week — workouts, nutrition, and how it's going — is coming soon."
                  />
                </section>
              )}

              {coachProfile && (
                <section>
                  <SectionHeading>Workouts</SectionHeading>
                  {recentSessions.length === 0 ? (
                    <p className="text-sm text-card-light-muted">Complete your first session to see it here.</p>
                  ) : (
                    <ul className="space-y-2">
                      {recentSessions.map((s) => (
                        <li
                          key={s.sessionId}
                          className="flex items-center justify-between rounded-lg border border-card-light-border p-4"
                        >
                          <div>
                            <p className="text-sm font-semibold">{formatDate(s.createdAt)}</p>
                            <p className="text-xs text-card-light-muted">{s.muscleGroups.join(", ")}</p>
                          </div>
                          <p className="text-sm text-card-light-muted">{Math.round(s.totalVolumeKg)}kg</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <section>
                <SectionHeading>Nutrition</SectionHeading>
                <Link href="/coach/nutrition" className="block rounded-xl border border-card-light-border p-5">
                  <p className="text-sm font-semibold">Nutrition</p>
                  <p className="mt-1 text-sm text-card-light-muted">See your daily calorie and macro targets.</p>
                </Link>
              </section>

              <section>
                <SectionHeading>Habits</SectionHeading>
                <ComingSoonCard title="Habit tracker" body="Track the habits you know you're bad at — coming soon." />
              </section>

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
      <BottomNav />
    </main>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">{children}</p>;
}

function ComingSoonCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-card-light-border p-5 opacity-70">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-card-light-muted">{body}</p>
    </div>
  );
}
