"use client";

import { Capacitor } from "@capacitor/core";
import { Health, type AggregatedSample, type HealthDataType } from "@capgo/capacitor-health";

// Health Connect only exists as a native Android API — there's no web/PWA
// fallback (unlike Fitbit, which is a plain OAuth flow that works in any
// browser). Gate every entry point on this so the option only ever
// appears inside the native Android app, never the PWA or iOS.
export function isHealthConnectSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

const READ_TYPES: HealthDataType[] = ["steps", "sleep", "restingHeartRate", "heartRateVariability"];

// Days of history to pull on first connect, so the recovery baseline
// (RECOVERY_MIN_BASELINE_DAYS, currently 5) doesn't need almost a week of
// app-opens to fill in — most Health Connect providers already hold this
// much on-device history from before the member ever connected here.
const INITIAL_BACKFILL_DAYS = 14;

// Days to re-pull on every subsequent sync (app foreground / Health tab
// open) — small on purpose. This isn't a background sync (Health Connect
// has no push-to-server mechanism; see 0079's migration comment), so each
// open just re-sends a short recent window, which naturally self-heals any
// gap from a missed day without re-sending weeks of unchanged history.
const ROUTINE_SYNC_DAYS = 3;

interface DailySnapshot {
  recordedDate: string;
  steps: number | null;
  sleepMinutes: number | null;
  restingHeartRate: number | null;
  hrvMs: number | null;
}

// AggregatedSample.startDate is an ISO 8601 bucket start; bucket: 'day'
// buckets by the device's local calendar day, so the date portion of
// startDate is already the right key — no separate timezone conversion.
function toDateKey(sample: AggregatedSample): string {
  return sample.startDate.slice(0, 10);
}

async function queryDailyAggregate(
  dataType: HealthDataType,
  aggregation: "sum" | "average",
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const result = await Health.queryAggregated({ dataType, startDate, endDate, bucket: "day", aggregation });
  const byDate = new Map<string, number>();
  for (const sample of result.samples) {
    byDate.set(toDateKey(sample), Math.round(sample.value));
  }
  return byDate;
}

async function readRecentSnapshots(days: number): Promise<DailySnapshot[]> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString();
  const endDate = end.toISOString();

  const [steps, sleep, restingHeartRate, hrv] = await Promise.all([
    queryDailyAggregate("steps", "sum", startDate, endDate),
    queryDailyAggregate("sleep", "sum", startDate, endDate),
    queryDailyAggregate("restingHeartRate", "average", startDate, endDate),
    queryDailyAggregate("heartRateVariability", "average", startDate, endDate),
  ]);

  const dates = new Set([...steps.keys(), ...sleep.keys(), ...restingHeartRate.keys(), ...hrv.keys()]);
  // Today is deliberately excluded, same as getRecentWearableSnapshots'
  // baseline window server-side — a partial, still-in-progress day isn't
  // a real data point yet, it'd just understate steps/sleep vs. every
  // other synced day.
  const todayKey = end.toISOString().slice(0, 10);
  dates.delete(todayKey);

  return Array.from(dates).map((recordedDate) => ({
    recordedDate,
    steps: steps.get(recordedDate) ?? null,
    sleepMinutes: sleep.get(recordedDate) ?? null,
    restingHeartRate: restingHeartRate.get(recordedDate) ?? null,
    hrvMs: hrv.get(recordedDate) ?? null,
  }));
}

async function postSnapshots(snapshots: DailySnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;
  const res = await fetch("/api/wearables/health-connect/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshots }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Sync failed.");
  }
}

// Requests permission, records the connection server-side, and does an
// immediate backfilled sync so the member sees real data on the Health
// tab right away rather than an empty "calibrating" state.
export async function connectHealthConnect(): Promise<{ connected: boolean; reason?: string }> {
  const availability = await Health.isAvailable();
  if (!availability.available) {
    return { connected: false, reason: availability.reason ?? "Health Connect isn't available on this device." };
  }

  const status = await Health.requestAuthorization({ read: READ_TYPES });
  if (!status.readAuthorized.includes("steps")) {
    return { connected: false, reason: "Permission was declined." };
  }

  const connectRes = await fetch("/api/wearables/health-connect/connect", { method: "POST" });
  if (!connectRes.ok) {
    return { connected: false, reason: "Couldn't save the connection. Try again." };
  }

  const snapshots = await readRecentSnapshots(INITIAL_BACKFILL_DAYS);
  await postSnapshots(snapshots);
  return { connected: true };
}

// Called opportunistically (Health tab mount, app foreground) — see the
// module comment on ROUTINE_SYNC_DAYS for why this can't be a background
// cron the way Fitbit's sync is.
export async function syncHealthConnect(): Promise<void> {
  const snapshots = await readRecentSnapshots(ROUTINE_SYNC_DAYS);
  await postSnapshots(snapshots);
}
