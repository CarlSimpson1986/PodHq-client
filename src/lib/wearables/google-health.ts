import "server-only";
import { OAuth2Client } from "google-auth-library";

// Base URL and REST shape confirmed live 2026-08-24 against Google's own
// discovery document (https://health.googleapis.com/$discovery/rest?version=v4)
// — the authoritative machine-readable schema, not a docs page. Two
// earlier same-day attempts at the request/response shape (an assumed
// {startTime, endTime} RFC3339 pair, then an assumed {year, month, day}
// directly under range.start) both came back with live 400s from
// Google's own API; the discovery document's DailyRollUpDataPointsRequest/
// CivilTimeInterval/CivilDateTime/DailyRollUpDataPointsResponse/
// DailyRollupDataPoint schemas below are what actually ships.
const API_BASE = "https://health.googleapis.com/v4";

// Scope naming confirmed live: googlehealth.{category}.readonly, moved
// off the old combined read/write scopes. health_metrics_and_measurements
// is the best-inferred name for the readonly variant (Google's docs
// showed .activity_and_fitness.readonly and .sleep.readonly explicitly,
// but not this one) — Cloud Console's own scope picker is the
// authoritative source when Carl sets up the OAuth consent screen; this
// is scaffolding, not a guarantee the literal string is exactly right.
export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly", // steps
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly", // resting heart rate
];

function getRedirectUri(): string {
  const uri = process.env.GOOGLE_HEALTH_REDIRECT_URI;
  if (!uri) throw new Error("GOOGLE_HEALTH_REDIRECT_URI is not configured");
  return uri;
}

// A fresh client per call, not a module-level singleton — this app is
// stateless/serverless (Vercel functions), so there's no benefit to
// reuse and every benefit to avoiding accidental cross-request state.
export function createOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_HEALTH_CLIENT_ID/GOOGLE_HEALTH_CLIENT_SECRET are not configured");
  }
  return new OAuth2Client(clientId, clientSecret, getRedirectUri());
}

export function buildAuthorizationUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    // 'offline' + prompt 'consent' — a refresh_token is only ever
    // returned on the first grant with these set; without 'consent' a
    // returning user who re-authorizes wouldn't get a new one issued.
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_HEALTH_SCOPES,
    state,
  });
}

// Exchanges the authorization code for tokens. The refresh_token only
// ever appears in this first exchange (Google's documented behavior,
// same as every other Google OAuth2 flow) — callers must persist it
// immediately, there's no second chance to fetch it later.
export async function exchangeCodeForTokens(code: string): Promise<{ refreshToken: string }> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh_token returned — the member may have already granted consent previously without re-prompting");
  }
  return { refreshToken: tokens.refresh_token };
}

function clientWithRefreshToken(refreshToken: string): OAuth2Client {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export interface DailyWearableData {
  steps: number | null;
  sleepMinutes: number | null;
  restingHeartRate: number | null;
}

// dataType id strings confirmed live against Google's docs: "steps",
// "daily-resting-heart-rate" — hyphenated, not underscored. "sleep" is
// deliberately absent — see the SLEEP_NOT_YET_SUPPORTED comment below.
const DATA_TYPES = {
  steps: "steps",
  restingHeartRate: "daily-resting-heart-rate",
} as const;

// Sleep is modeled as session records (Sleep/SleepSummary/SleepStage —
// start/end times, not a single daily number) — confirmed by reading
// the discovery document's DailyRollupDataPoint schema, whose value
// union has no "sleep" property at all alongside "steps"/"heartRate"/
// etc, so dailyRollUp simply doesn't summarize it the way it does the
// other two fields. Getting a daily sleep-duration number needs reading
// Sleep session records directly and summing durations client-side —
// real, separate work, not a parsing fix. Tracked as its own follow-up;
// this file no longer even attempts the doomed dailyRollUp call for it.
const SLEEP_NOT_YET_SUPPORTED = true;

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

function civilDateFromIso(dateIso: string): CivilDate {
  const [year, month, day] = dateIso.split("-").map(Number);
  return { year, month, day };
}

// dailyRollUp's "range" is a CivilTimeInterval, whose start/end are each
// a CivilDateTime — {date: Date, time?: TimeOfDay} — NOT a Date object
// directly. Two earlier same-day attempts got this wrong and both came
// back with live 400s from Google's own API: first an assumed
// {startTime, endTime} RFC3339-string pair ('Unknown name "startTime" at
// range'), then an assumed {year, month, day} directly under range.start
// ('Unknown name "year" at range.start' — because range.start is a
// CivilDateTime, whose only valid properties are "date" and "time", not
// year/month/day themselves). Confirmed against the discovery document's
// CivilTimeInterval/CivilDateTime/Date schemas, not assumed a third time.
// The exclusive end is the requested date plus one day.
function dailyCivilRange(dateIso: string): { start: { date: CivilDate }; end: { date: CivilDate } } {
  const start = civilDateFromIso(dateIso);
  const endDate = new Date(Date.UTC(start.year, start.month - 1, start.day + 1));
  return {
    start: { date: start },
    end: { date: { year: endDate.getUTCFullYear(), month: endDate.getUTCMonth() + 1, day: endDate.getUTCDate() } },
  };
}

async function fetchDailyRollup(client: OAuth2Client, dataType: string, dateIso: string): Promise<unknown> {
  const accessToken = await client.getAccessToken();
  const res = await fetch(`${API_BASE}/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ range: dailyCivilRange(dateIso) }),
  });
  if (!res.ok) {
    throw new Error(`Google Health API ${dataType} rollup failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Response shape confirmed against the discovery document's
// DailyRollUpDataPointsResponse/DailyRollupDataPoint/StepsRollupValue
// schemas: the top-level array is "rollupDataPoints" (not "dataPoints"
// — that name belongs to the separate, non-civil-time `rollUp` method's
// response, a different endpoint entirely). Steps uses "countSum" (an
// int64, so serialized as a numeric *string* — Google's standard
// convention, hence the Number() coercion). Still logs the raw rollup
// point whenever a value can't be extracted, so a further schema
// surprise shows up in Vercel logs instead of silently rendering as
// "—" again. An empty/missing rollupDataPoints array (as opposed to a
// thrown error) means Google accepted the request but has nothing to
// roll up for that day — genuinely no synced data yet, not a parsing
// bug; still logged the same way so it's visible either way.
function extractStepsRollupValue(body: unknown): number | null {
  if (!body || typeof body !== "object") {
    console.error("[google-health] steps rollup response was not an object", { body });
    return null;
  }
  const points = (body as { rollupDataPoints?: unknown[] }).rollupDataPoints;
  if (!Array.isArray(points) || points.length === 0) {
    console.error("[google-health] steps rollup had no rollupDataPoints — no data synced for this day yet, or a shape mismatch", { body });
    return null;
  }
  const first = points[0] as { steps?: { countSum?: string | number } };
  const raw = first.steps?.countSum;
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || Number.isNaN(value)) {
    console.error("[google-health] steps rollup dataPoint had no extractable countSum — logging shape for verification", { first });
    return null;
  }
  return Math.round(value);
}

// daily-resting-heart-rate does NOT support the dailyRollUp action at
// all — confirmed live 2026-08-24: 'DailyRollup is not supported for
// data type daily-resting-heart-rate, but the following actions are
// supported: list, reconcile'. Uses `list` instead, filtered to the one
// requested civil date via the AIP-160 filter syntax the discovery
// document documents for daily-summary data types
// ({data_type_with_underscores}.date >= "YYYY-MM-DD" AND ... < "...").
// Response is DataPoint[] with a dailyRestingHeartRate.beatsPerMinute
// field (int64-as-string) — a genuine single daily value, unlike
// dailyRollUp's personal-range min/max this replaced.
async function fetchRestingHeartRate(client: OAuth2Client, dateIso: string): Promise<number | null> {
  const accessToken = await client.getAccessToken();
  const { end } = dailyCivilRange(dateIso);
  const endIso = `${end.date.year}-${String(end.date.month).padStart(2, "0")}-${String(end.date.day).padStart(2, "0")}`;
  const filter = `daily_resting_heart_rate.date >= "${dateIso}" AND daily_resting_heart_rate.date < "${endIso}"`;

  const res = await fetch(
    `${API_BASE}/users/me/dataTypes/${DATA_TYPES.restingHeartRate}/dataPoints?filter=${encodeURIComponent(filter)}`,
    { headers: { Authorization: `Bearer ${accessToken.token}` } }
  );
  if (!res.ok) {
    throw new Error(`Google Health API resting-heart-rate list failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { dataPoints?: { dailyRestingHeartRate?: { beatsPerMinute?: string | number } }[] };
  const first = body.dataPoints?.[0]?.dailyRestingHeartRate;
  const raw = first?.beatsPerMinute;
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || Number.isNaN(value)) {
    console.error("[google-health] resting-heart-rate list had no extractable beatsPerMinute — no data synced for this day yet, or a shape mismatch", { body });
    return null;
  }
  return Math.round(value);
}

// Fetches one calendar day's steps/sleep/resting-heart-rate for a member
// whose refresh token has already been decrypted by the caller — see
// src/lib/data/wearables.ts. A single field's request failing (a data
// type with no data that day, or a transient error) doesn't fail the
// other two — each is fetched and parsed independently. Sleep always
// resolves to null without an API call — see SLEEP_NOT_YET_SUPPORTED.
export async function fetchDailyData(refreshToken: string, dateIso: string): Promise<DailyWearableData> {
  const client = clientWithRefreshToken(refreshToken);

  if (SLEEP_NOT_YET_SUPPORTED) {
    console.error("[google-health] sleep skipped — dailyRollUp has no sleep field, needs the session-based endpoint instead");
  }

  const [stepsResult, restingHeartRateResult] = await Promise.allSettled([
    fetchDailyRollup(client, DATA_TYPES.steps, dateIso),
    fetchRestingHeartRate(client, dateIso),
  ]);

  let steps: number | null = null;
  if (stepsResult.status === "fulfilled") {
    steps = extractStepsRollupValue(stepsResult.value);
  } else {
    console.error("[google-health] steps rollup request failed", { reason: String(stepsResult.reason) });
  }

  let restingHeartRate: number | null = null;
  if (restingHeartRateResult.status === "fulfilled") {
    restingHeartRate = restingHeartRateResult.value;
  } else {
    console.error("[google-health] resting-heart-rate list request failed", { reason: String(restingHeartRateResult.reason) });
  }

  return { steps, sleepMinutes: null, restingHeartRate };
}
