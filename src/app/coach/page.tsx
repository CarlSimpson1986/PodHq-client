import { redirect } from "next/navigation";
import Link from "next/link";
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

// The dedicated "premium app within the app" space (Stage 5) — status,
// today's workout, recent workouts, and honest placeholders for the
// features that aren't built yet (nutrition, tech integrations,
// challenges) rather than hiding them or faking output. See ROADMAP.md's
// "Hove AI Coach trial beta" entry.
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
      <div className="card-light flex-1 space-y-4 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
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

              {coachProfile && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Recent workouts</p>
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
                </div>
              )}

              <ComingSoonCard title="Nutrition" body="Your meal preferences are saved from onboarding — meal plans and macro tracking are coming soon." />
              <ComingSoonCard
                title="Tech integrations"
                body="HRV, resting pulse, sleep, and steps need the native app (Apple Health / Google Health Connect aren't accessible from this web app) — coming with a future update."
              />
              <ComingSoonCard title="Challenges" body="Community challenges are coming soon." />
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function ComingSoonCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-card-light-border p-5 opacity-70">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-card-light-muted">{body}</p>
    </div>
  );
}
