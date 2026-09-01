import { z } from "zod";

// One entry per day the native app read from Health Connect. Bounded to
// 14 days per request — matches the recovery baseline window
// (RECOVERY_MIN_BASELINE_DAYS's lookback in recovery-status.ts) plus
// slack, not an arbitrary cap; a member reconnecting after a long gap
// still only needs a couple weeks of history for baseline/trend purposes.
export const healthConnectSyncSchema = z
  .object({
    snapshots: z
      .array(
        z
          .object({
            recordedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            steps: z.number().int().min(0).max(200_000).nullable(),
            sleepMinutes: z.number().int().min(0).max(1_440).nullable(),
            restingHeartRate: z.number().int().min(0).max(300).nullable(),
            hrvMs: z.number().int().min(0).max(2_000).nullable(),
          })
          .strict()
      )
      .min(1)
      .max(14),
  })
  .strict();
