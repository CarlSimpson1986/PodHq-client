import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret-encryption";

export interface WearableConnection {
  memberId: number;
  provider: "fitbit";
  refreshToken: string;
}

export interface WearableSnapshot {
  recordedDate: string;
  steps: number | null;
  sleepMinutes: number | null;
  restingHeartRate: number | null;
}

export async function getWearableConnection(memberId: number): Promise<WearableConnection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_wearable_connections")
    .select("member_id, provider, refresh_token_encrypted")
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    memberId: data.member_id,
    provider: data.provider as "fitbit",
    refreshToken: decryptSecret(data.refresh_token_encrypted),
  };
}

// Every connected member, for the daily sync cron — never fails the
// whole read for one bad row's decryption; a member whose token can't be
// decrypted (e.g. a SECRET_ENCRYPTION_KEY rotation without re-auth) is
// skipped for this sync rather than crashing the batch, same resilience
// posture as the per-member try/catch in the sync route itself.
export async function getAllWearableConnections(): Promise<WearableConnection[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("member_wearable_connections").select("member_id, provider, refresh_token_encrypted");
  if (error) throw new Error(error.message);

  const connections: WearableConnection[] = [];
  for (const row of data ?? []) {
    try {
      connections.push({ memberId: row.member_id, provider: row.provider as "fitbit", refreshToken: decryptSecret(row.refresh_token_encrypted) });
    } catch (err) {
      console.error("[wearables] failed to decrypt a connection's refresh token, skipping", { memberId: row.member_id, error: (err as Error).message });
    }
  }
  return connections;
}

// Upsert on member_id (unique) — reconnecting after a prior connection
// (e.g. the member revoked and re-granted access on Google's side)
// replaces the old token rather than erroring on a duplicate.
export async function saveWearableConnection(memberId: number, refreshToken: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_wearable_connections").upsert(
    {
      member_id: memberId,
      provider: "fitbit",
      refresh_token_encrypted: encryptSecret(refreshToken),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );
  if (error) throw new Error(error.message);
}

// Deletes the connection AND every previously-synced data row for this
// member — confirmed with Carl as the correct disconnect behavior for
// special-category health data (a real "right to erasure" action, not
// just a future-syncs-off toggle). Data first, then the connection: if
// the data delete fails partway, a retry of this same call is still safe
// (both deletes are idempotent no-ops on rows that no longer exist).
export async function deleteWearableConnectionAndData(memberId: number): Promise<void> {
  const admin = createAdminClient();
  const { error: dataError } = await admin.from("member_wearable_data").delete().eq("member_id", memberId);
  if (dataError) throw new Error(dataError.message);

  const { error: connectionError } = await admin.from("member_wearable_connections").delete().eq("member_id", memberId);
  if (connectionError) throw new Error(connectionError.message);
}

// Upsert on (member_id, recorded_date) — a re-sync of a day already
// synced (the cron re-running, or a late-arriving correction from the
// provider) replaces that day's values rather than duplicating the row.
export async function saveWearableSnapshot(memberId: number, snapshot: WearableSnapshot): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_wearable_data").upsert(
    {
      member_id: memberId,
      recorded_date: snapshot.recordedDate,
      steps: snapshot.steps,
      sleep_minutes: snapshot.sleepMinutes,
      resting_heart_rate: snapshot.restingHeartRate,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "member_id,recorded_date" }
  );
  if (error) throw new Error(error.message);
}

// Trailing baseline window for recovery-signal.ts — excludes today by
// construction (recorded_date < today), so a caller comparing "today vs
// baseline" never accidentally compares a day against itself.
export async function getRecentWearableSnapshots(memberId: number, days = 14): Promise<WearableSnapshot[]> {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("member_wearable_data")
    .select("recorded_date, steps, sleep_minutes, resting_heart_rate")
    .eq("member_id", memberId)
    .gte("recorded_date", sinceIso)
    .lt("recorded_date", todayIso)
    .order("recorded_date", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    recordedDate: row.recorded_date,
    steps: row.steps,
    sleepMinutes: row.sleep_minutes,
    restingHeartRate: row.resting_heart_rate,
  }));
}

export async function getLatestWearableSnapshot(memberId: number): Promise<WearableSnapshot | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_wearable_data")
    .select("recorded_date, steps, sleep_minutes, resting_heart_rate")
    .eq("member_id", memberId)
    .order("recorded_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    recordedDate: data.recorded_date,
    steps: data.steps,
    sleepMinutes: data.sleep_minutes,
    restingHeartRate: data.resting_heart_rate,
  };
}
