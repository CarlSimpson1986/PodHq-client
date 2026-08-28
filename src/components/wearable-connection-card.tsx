"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const dangerButtonClass =
  "w-full rounded-lg border border-danger/50 px-4 py-3 text-center text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50";

// Redesigned 2026-08-28: per-metric current-value+trend now lives in its
// own card each (StepGauge, and HealthMetricCard for sleep/RHR/HRV) on
// the Health page below this one — showing the same four numbers again
// here was a flat, non-expandable duplicate of what those cards already
// do better. This card is connection status only now: connect/refresh/
// disconnect, plus when it last synced.
export function WearableConnectionCard({
  connected,
  lastSyncedDate,
}: {
  connected: boolean;
  lastSyncedDate: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wearableParam = searchParams.get("wearable");

  async function handleDisconnect() {
    setError(null);
    setDisconnecting(true);
    try {
      const res = await fetch("/api/wearables/fitbit/disconnect", { method: "POST" });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRefresh() {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch("/api/wearables/fitbit/refresh", { method: "POST" });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="rounded-xl border border-card-light-border p-5">
      <p className="text-sm font-semibold">Connection</p>

      {wearableParam === "error" && (
        <p className="mt-2 text-sm text-danger">Couldn&apos;t connect Fitbit — try again, or contact staff if it keeps happening.</p>
      )}

      {!connected ? (
        <>
          <p className="mt-1 text-sm text-card-light-muted">
            Connect your Fitbit account to bring your steps, sleep and resting heart rate into your AI Coach. We read this
            data to personalise your weekly check-in — nothing is shared, and you can disconnect at any time.
          </p>
          <a href="/api/wearables/fitbit/connect" className={`${buttonClass} mt-4 block`}>
            Connect Fitbit
          </a>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-card-light-muted">Connected via Fitbit (Google Health).</p>
          <p className="mt-3 text-sm text-card-light-muted">
            {lastSyncedDate ? `Last synced ${lastSyncedDate}.` : "No data synced yet — refresh below to pull it in now."}
          </p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button type="button" onClick={handleRefresh} disabled={refreshing} className={`${buttonClass} mt-4`}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" onClick={handleDisconnect} disabled={disconnecting} className={`${dangerButtonClass} mt-2`}>
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </>
      )}
    </div>
  );
}
