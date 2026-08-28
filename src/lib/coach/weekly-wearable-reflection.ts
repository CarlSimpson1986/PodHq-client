import "server-only";
import {
  RECOVERY_MIN_BASELINE_DAYS,
  RECOVERY_RESTING_HR_DELTA,
  RECOVERY_SLEEP_MINUTES_DELTA,
} from "@/lib/coach/types";
import type { WearableSnapshot } from "@/lib/data/wearables";
import { getWearableSnapshotsBefore } from "@/lib/data/wearables";

export interface WearableReflectionItem {
  metric: "sleep" | "resting_hr";
  direction: "up" | "down";
  text: string;
}

// Reuses recovery-signal.ts's own thresholds — a week-scoped average is
// smoother/less noisy than a single day, so the same deltas are if
// anything more conservative applied here, not a new invented number.
// "typical" (within the delta either way) is deliberately not surfaced —
// same "only speak up when there's a real signal" restraint
// recovery-signal.ts's own "normal" case already applies.
const REFLECTION_COPY: Record<"sleep_up" | "sleep_down" | "resting_hr_up" | "resting_hr_down", string> = {
  sleep_up: "You've been sleeping more than usual this week — a real recovery advantage, worth keeping up.",
  sleep_down: "Your sleep dipped below your usual this week. An earlier night or two, if you can manage it, would help.",
  resting_hr_down: "Your resting heart rate has been lower than usual — often a sign your fitness or recovery is trending the right way.",
  resting_hr_up: "Your resting heart rate has been a little higher than usual this week. Could just be normal variation, but worth keeping an eye on if it continues.",
};

function average(values: (number | null)[]): { mean: number; count: number } | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return { mean: present.reduce((sum, v) => sum + v, 0) / present.length, count: present.length };
}

// Pure — takes this week's already-computed averages (weekly-review.ts)
// and a baseline sample, returns 0-2 items (never more than one per
// metric). No network/DB access here, matching recovery-signal.ts's own
// pure/impure split; getWearableWeeklyReflection below is the thin async
// wrapper that actually fetches the baseline.
export function computeWearableWeeklyReflection(
  thisWeek: { avgSleepMinutes: number | null; avgRestingHeartRate: number | null },
  baseline: WearableSnapshot[]
): WearableReflectionItem[] {
  const items: WearableReflectionItem[] = [];

  const sleepBaseline = average(baseline.map((b) => b.sleepMinutes));
  if (thisWeek.avgSleepMinutes !== null && sleepBaseline !== null && sleepBaseline.count >= RECOVERY_MIN_BASELINE_DAYS) {
    if (thisWeek.avgSleepMinutes <= sleepBaseline.mean - RECOVERY_SLEEP_MINUTES_DELTA) {
      items.push({ metric: "sleep", direction: "down", text: REFLECTION_COPY.sleep_down });
    } else if (thisWeek.avgSleepMinutes >= sleepBaseline.mean + RECOVERY_SLEEP_MINUTES_DELTA) {
      items.push({ metric: "sleep", direction: "up", text: REFLECTION_COPY.sleep_up });
    }
  }

  const hrBaseline = average(baseline.map((b) => b.restingHeartRate));
  if (thisWeek.avgRestingHeartRate !== null && hrBaseline !== null && hrBaseline.count >= RECOVERY_MIN_BASELINE_DAYS) {
    if (thisWeek.avgRestingHeartRate >= hrBaseline.mean + RECOVERY_RESTING_HR_DELTA) {
      items.push({ metric: "resting_hr", direction: "up", text: REFLECTION_COPY.resting_hr_up });
    } else if (thisWeek.avgRestingHeartRate <= hrBaseline.mean - RECOVERY_RESTING_HR_DELTA) {
      items.push({ metric: "resting_hr", direction: "down", text: REFLECTION_COPY.resting_hr_down });
    }
  }

  return items;
}

export async function getWearableWeeklyReflection(
  memberId: number,
  periodStart: string,
  thisWeek: { avgSleepMinutes: number | null; avgRestingHeartRate: number | null }
): Promise<WearableReflectionItem[]> {
  const baseline = await getWearableSnapshotsBefore(memberId, periodStart);
  return computeWearableWeeklyReflection(thisWeek, baseline);
}
