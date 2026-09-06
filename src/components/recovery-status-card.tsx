import Link from "next/link";
import type { RecoveryStatus } from "@/lib/coach/recovery-status";
import { HeartPulseIcon } from "@/components/icons";

// Dashboard hero + Health tab both render this. Deliberately never shows a
// fabricated 0-100 "readiness score" — no such field exists anywhere in
// the Google Health API (confirmed against the live discovery document),
// and Google's own consumer app shows a "Vitals: N of 5 — Calibrating"
// coverage indicator rather than a composite score. This mirrors that
// same honest framing using data we actually have.
const REASON_COPY: Record<"elevated_resting_hr" | "low_sleep" | "self_reported", string> = {
  elevated_resting_hr: "Your resting heart rate is higher than your recent average.",
  low_sleep: "You slept noticeably less than your recent average.",
  // Not currently reachable here — self_reported only ever comes from a
  // per-session readiness check (workout-session.ts), and this card is fed
  // by the wearable-only getRecoveryStatus — but the shared RecoverySignal
  // union includes it, so this must stay exhaustive rather than assume.
  self_reported: "You told us you're feeling low on energy, sleep, or soreness today.",
};

export function RecoveryStatusCard({ status }: { status: RecoveryStatus }) {
  if (status.kind === "not_connected") {
    return (
      <div className="card-light flex flex-col items-center p-5 text-center">
        <HeartPulseIcon className="h-6 w-6 text-card-light-foreground" />
        <p className="mt-2 text-sm font-semibold">Connect your tech</p>
        <p className="mt-1 text-sm text-card-light-muted">Sync Fitbit via Google Health to see your recovery here.</p>
        <Link href="/health" prefetch={false} className="mt-3 inline-block text-xs font-semibold underline">
          Connect on the Health tab →
        </Link>
      </div>
    );
  }

  if (status.kind === "calibrating" || status.kind === "insufficient_data") {
    const baselineDays = status.kind === "calibrating" ? status.baselineDays : 0;
    const baselineDaysNeeded = status.kind === "calibrating" ? status.baselineDaysNeeded : 5;
    return (
      <div className="card-light flex flex-col items-center p-5 text-center">
        <HeartPulseIcon className="h-6 w-6 text-card-light-foreground" />
        <p className="mt-2 text-sm font-semibold">Calibrating your recovery</p>
        <p className="mt-1 text-sm text-card-light-muted">
          Day {baselineDays} of {baselineDaysNeeded} — keep your wearable synced and this will start showing real signal.
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card-light-border">
          <div
            className="h-full rounded-full bg-card-light-foreground"
            style={{ width: `${Math.min(100, Math.round((baselineDays / baselineDaysNeeded) * 100))}%` }}
          />
        </div>
      </div>
    );
  }

  if (status.kind === "low_recovery") {
    return (
      <div className="card-light flex flex-col items-center p-5 text-center">
        <HeartPulseIcon className="h-6 w-6 text-warning" />
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-warning">Recovery looks low today</p>
        <p className="mt-1 text-sm text-card-light-muted">{REASON_COPY[status.reason]}</p>
      </div>
    );
  }

  return (
    <div className="card-light flex flex-col items-center p-5 text-center">
      <HeartPulseIcon className="h-6 w-6 text-success" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-success">Recovery on track</p>
      <p className="mt-1 text-sm text-card-light-muted">Nothing unusual against your recent average — good to train as planned.</p>
    </div>
  );
}
