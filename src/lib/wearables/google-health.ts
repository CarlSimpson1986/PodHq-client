import "server-only";
import { OAuth2Client } from "google-auth-library";

// Base URL and REST shape confirmed live 2026-08-24 against Google's own
// docs (developers.google.com/health) — this is a new API (GA May 2026),
// not something in general training knowledge, so every constant below
// was checked rather than assumed. What's NOT independently confirmed:
// the exact JSON response field names for a dailyRollUp call — Google's
// docs describe the endpoints and constraints but don't publish a worked
// response example. parseDailyRollupResponse below is the one place that
// needs checking against a real response once Carl has live OAuth
// credentials (see ROADMAP.md's wearable-integration note) — everything
// else here (scopes, paths, dataType ids) is grounded in the live docs.
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
// "sleep", "daily-resting-heart-rate" — hyphenated, not underscored.
const DATA_TYPES = {
  steps: "steps",
  sleep: "sleep",
  restingHeartRate: "daily-resting-heart-rate",
} as const;

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

function civilDateFromIso(dateIso: string): CivilDate {
  const [year, month, day] = dateIso.split("-").map(Number);
  return { year, month, day };
}

// dailyRollUp's "range" is a closed-open CivilTimeInterval (calendar
// dates, not RFC3339 instants) — confirmed 2026-08-24 against Google's
// REST reference after the originally-assumed {startTime, endTime}
// RFC3339-string shape came back with a live 400: 'Unknown name
// "startTime" at range: Cannot find field.' The exclusive end is the
// requested date plus one day.
function dailyCivilRange(dateIso: string): { start: CivilDate; end: CivilDate } {
  const start = civilDateFromIso(dateIso);
  const endDate = new Date(Date.UTC(start.year, start.month - 1, start.day + 1));
  return {
    start,
    end: { year: endDate.getUTCFullYear(), month: endDate.getUTCMonth() + 1, day: endDate.getUTCDate() },
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

// NEEDS FURTHER VERIFICATION for sleep/resting-heart-rate specifically —
// see the file-level comment. Steps' shape is confirmed from a real
// example response ({"dataPoints":[{"date":"...","countSum":"9037"}]} —
// countSum as a string, Google's standard int64-as-string JSON
// convention); sleep and resting-heart-rate likely use a differently-
// named field for their own aggregation (duration/average rather than
// sum) that hasn't been confirmed yet. Tries the confirmed `countSum`
// key first, falls back to the originally-assumed generic `value`
// wrapper in case a data type uses that shape instead, and — either way
// — logs the raw first data point whenever no numeric value is found, so
// the exact real field name for sleep/resting-heart-rate shows up in
// Vercel logs on the next real call instead of silently staying blank.
function extractRollupValue(dataType: string, body: unknown): number | null {
  if (!body || typeof body !== "object") {
    console.error("[google-health] rollup response was not an object", { dataType, body });
    return null;
  }
  const points = (body as { dataPoints?: unknown[] }).dataPoints;
  if (!Array.isArray(points) || points.length === 0) {
    console.error("[google-health] rollup response had no dataPoints — logging shape for verification", { dataType, body });
    return null;
  }
  const first = points[0] as { countSum?: string | number; value?: { intValue?: number; fpValue?: number } };
  const raw = first.countSum ?? first.value?.intValue ?? first.value?.fpValue;
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || Number.isNaN(value)) {
    console.error("[google-health] rollup dataPoint had no numeric value — logging shape for verification", { dataType, first });
    return null;
  }
  return Math.round(value);
}

// Fetches one calendar day's steps/sleep/resting-heart-rate for a member
// whose refresh token has already been decrypted by the caller — see
// src/lib/data/wearables.ts. A single field's request failing (a data
// type with no data that day, or a transient error) doesn't fail the
// other two — each is fetched and parsed independently.
export async function fetchDailyData(refreshToken: string, dateIso: string): Promise<DailyWearableData> {
  const client = clientWithRefreshToken(refreshToken);

  const dataTypeByIndex = [DATA_TYPES.steps, DATA_TYPES.sleep, DATA_TYPES.restingHeartRate];
  const results = await Promise.allSettled([
    fetchDailyRollup(client, DATA_TYPES.steps, dateIso),
    fetchDailyRollup(client, DATA_TYPES.sleep, dateIso),
    fetchDailyRollup(client, DATA_TYPES.restingHeartRate, dateIso),
  ]);

  const [steps, sleep, restingHeartRate] = results.map((r, i) => {
    if (r.status === "rejected") {
      // Previously discarded entirely — a request failure (bad scope,
      // wrong dataType id, expired token) looked identical to "no data
      // today" with nothing in the logs to tell them apart.
      console.error("[google-health] rollup request failed", { dataType: dataTypeByIndex[i], reason: String(r.reason) });
      return null;
    }
    return extractRollupValue(dataTypeByIndex[i], r.value);
  });

  return { steps, sleepMinutes: sleep, restingHeartRate };
}
