"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DumbbellIcon } from "@/components/icons";

type Step = "banner" | "preview" | "confirmation";

const OUTCOMES = [
  "A fully personalised coaching journey — tailored nutrition and training built around you",
  "Real accountability, not just an app you forget to open",
  "Dramatically increases your chances of actually getting the results you want",
  "Syncs with your wearable — Fitbit, Health Connect, and more",
];

// State 1's trial pitch (brief §7). Copy updated 2026-09-02 twice same
// day — first pass (Carl: "give them reasons to do the trial") replaced
// the original 3 generic bullets with specifics reflecting what the
// trial actually includes by now (nutrition targets and the
// research-grounded coach chat were both out of scope when the original
// list was written, and have since shipped — see ROADMAP.md). Second
// pass (Carl, reviewing live: "it's not just your free AI Coach trial,
// it's a free upgrade to Premium") reframed the header/subtitle around
// that positioning and swapped the bullets for outcome-level selling
// points (personalisation, accountability, results, wearable sync)
// rather than feature-level ones. The trial genuinely runs the full
// premium feature set for 7 days, not a limited demo —
// getCoachHomeState treats trial_active identically to subscriber
// everywhere else in the app — so this framing is accurate, not just
// persuasive; no pricing is shown, this component has no access to it.
export function TrialBanner() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("banner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTrial() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/member/start-trial", { method: "POST" });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong. Try again.");
        return;
      }
      setStep("confirmation");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStep("preview")}
        className="w-full rounded-xl bg-accent p-4 text-left text-accent-foreground shadow-md"
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Limited offer · Free</p>
        <p className="mt-1 text-base font-semibold">7 Day Premium Trial</p>
        <p className="mt-0.5 text-sm opacity-90">AI Coach — personalised workouts that adapt as you train</p>
      </button>

      {step !== "banner" && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-card-light p-6 text-card-light-foreground sm:rounded-2xl">
            {step === "preview" && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
                  7 days · Free · No card needed
                </p>
                <h2 className="mt-2 text-xl font-semibold">Free upgrade to Premium</h2>
                <p className="mt-1 text-sm text-card-light-muted">
                  Everything Premium members get — including Pod Coach — free for a week.
                </p>
                <ul className="mt-4 space-y-3">
                  {OUTCOMES.map((outcome, i) => (
                    <li key={outcome} className="flex items-start gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent-foreground">
                        <DumbbellIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="pt-0.5">
                        <span className="mr-1 font-mono text-xs text-card-light-muted">{String(i + 1).padStart(2, "0")}</span>
                        {outcome}
                      </span>
                    </li>
                  ))}
                </ul>

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                <button
                  type="button"
                  onClick={startTrial}
                  disabled={loading}
                  className="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? "Starting..." : "Start my free trial →"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("banner")}
                  className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-card-light-muted"
                >
                  Not now
                </button>
                <p className="mt-3 text-center text-xs text-card-light-muted">
                  No card required. Trial activates on your first session.
                </p>
              </>
            )}

            {step === "confirmation" && (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                  <DumbbellIcon className="h-6 w-6 text-accent-foreground" />
                </div>
                <h2 className="mt-4 text-center text-xl font-semibold">You&apos;re in.</h2>
                <p className="mt-2 text-center text-sm text-card-light-muted">
                  Your 7-day AI Coach trial starts automatically the moment you book your next session — no extra
                  step needed.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep("banner");
                    router.refresh();
                  }}
                  className="mt-6 w-full rounded-lg bg-card-light-foreground px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  Go to my app →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
