import Link from "next/link";
import type { RecoveryStatus } from "@/lib/coach/recovery-status";

// Dashboard hero + Health tab both render this. Deliberately never shows a
// fabricated 0-100 "readiness score" — no such field exists anywhere in
// the Google Health API (confirmed against the live discovery document),
// and Google's own consumer app shows a "Vitals: N of 5 — Calibrating"
// coverage indicator rather than a composite score. This mirrors that
// same honest framing using data we actually have.
const REASON_COPY: Record<"elevated_resting_hr" | "low_sleep", string> = {
  elevated_resting_hr: "Your resting heart rate is higher than your recent average.",
  low_sleep: "You slept noticeably less than your recent average.",
};

export function RecoveryStatusCard({ status }: { status: RecoveryStatus }) {
  if (status.kind === "not_connected") {
    return (
      <div className="card-glass p-5">
        <p className="text-sm font-semibold text-foreground">Connect your wearable</p>
        <p className="mt-1 text-sm text-muted-foreground">Sync Fitbit via Google Health to see your recovery here.</p>
        <Link href="/health" className="mt-3 inline-block text-xs font-semibold text-accent underline">
          Connect on the Health tab →
        </Link>
      </div>
    );
  }

  if (status.kind === "calibrating" || status.kind === "insufficient_data") {
    const baselineDays = status.kind === "calibrating" ? status.baselineDays : 0;
    const baselineDaysNeeded = status.kind === "calibrating" ? status.baselineDaysNeeded : 5;
    return (
      <div className="card-glass p-5">
        <p className="text-sm font-semibold text-foreground">Calibrating your recovery</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Day {baselineDays} of {baselineDaysNeeded} — keep your wearable synced and this will start showing real signal.
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card-border">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, Math.round((baselineDays / baselineDaysNeeded) * 100))}%` }}
          />
        </div>
      </div>
    );
  }

  if (status.kind === "low_recovery") {
    return (
      <div className="card-glass p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-warning">Recovery looks low today</p>
        <p className="mt-1 text-sm text-muted-foreground">{REASON_COPY[status.reason]}</p>
      </div>
    );
  }

  return (
    <div className="card-glass p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-success">Recovery on track</p>
      <p className="mt-1 text-sm text-muted-foreground">Nothing unusual against your recent average — good to train as planned.</p>
    </div>
  );
}
