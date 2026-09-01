"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { connectHealthConnect, isHealthConnectSupported, syncHealthConnect } from "@/lib/wearables/health-connect-client";
import type { WearableProvider } from "@/lib/data/wearables";

const NOOP_SUBSCRIBE = () => () => {};

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const secondaryButtonClass =
  "w-full rounded-lg border border-card-light-border px-4 py-3 text-center text-sm font-semibold transition-colors hover:bg-card-light-border/20 disabled:opacity-50";
const dangerButtonClass =
  "w-full rounded-lg border border-danger/50 px-4 py-3 text-center text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50";

const PROVIDER_LABEL: Record<WearableProvider, string> = {
  fitbit: "Fitbit (Google Health)",
  health_connect: "Health Connect",
};

// Redesigned 2026-08-28: per-metric current-value+trend now lives in its
// own card each (StepGauge, and HealthMetricCard for sleep/RHR/HRV) on
// the Health page below this one — showing the same four numbers again
// here was a flat, non-expandable duplicate of what those cards already
// do better. This card is connection status only now: connect/refresh/
// disconnect, plus when it last synced.
//
// Health Connect added 2026-09-01 as a second option alongside Fitbit —
// only offered inside the native Android app (isHealthConnectSupported),
// since it's a device-local API with no PWA/web equivalent. "Refresh" for
// it re-reads on-device data and re-POSTs rather than hitting the Fitbit
// refresh route (see health-connect-client.ts for why there's no
// server-side cron possible for this source).
export function WearableConnectionCard({
  connected,
  provider,
  lastSyncedDate,
}: {
  connected: boolean;
  provider: WearableProvider | null;
  lastSyncedDate: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // useSyncExternalStore, not a useState+useEffect pair — isHealthConnectSupported()
  // reads Capacitor's browser-only globals, so the client's first render would
  // compute a real value against the server's stubbed `false`, a genuine
  // hydration mismatch (React error #418), not just the react-hooks/set-state-in-effect
  // lint's cascading-render concern. Same fix already proven for use-install-prompt.ts's
  // standalone/ios detection.
  const healthConnectAvailable = useSyncExternalStore(NOOP_SUBSCRIBE, isHealthConnectSupported, () => false);

  // Opportunistic sync on mount — the "app foreground" trigger mentioned
  // in health-connect-client.ts, since there's no background cron for
  // this source. Silent: a failure here just means today's numbers are a
  // day stale until the next open, not worth surfacing as an error the
  // member has to dismiss on every single page load.
  useEffect(() => {
    if (connected && provider === "health_connect" && isHealthConnectSupported()) {
      syncHealthConnect()
        .then(() => router.refresh())
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (provider === "health_connect") {
        await syncHealthConnect();
      } else {
        const res = await fetch("/api/wearables/fitbit/refresh", { method: "POST" });
        const body = await res.json();
        if (body.status !== "ok") {
          setError(body.message ?? "Something went wrong.");
          return;
        }
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleConnectHealthConnect() {
    setError(null);
    setConnecting(true);
    try {
      const result = await connectHealthConnect();
      if (!result.connected) {
        setError(result.reason ?? "Couldn't connect Health Connect.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setConnecting(false);
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
            Connect a wearable to bring your steps, sleep and resting heart rate into your AI Coach. We read this data to
            personalise your weekly check-in — nothing is shared, and you can disconnect at any time.
          </p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <a href="/api/wearables/fitbit/connect" className={`${buttonClass} mt-4 block`}>
            Connect Fitbit
          </a>
          {healthConnectAvailable && (
            <button type="button" onClick={handleConnectHealthConnect} disabled={connecting} className={`${secondaryButtonClass} mt-2`}>
              {connecting ? "Connecting..." : "Connect Health Connect"}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-card-light-muted">Connected via {provider ? PROVIDER_LABEL[provider] : "a wearable"}.</p>
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
