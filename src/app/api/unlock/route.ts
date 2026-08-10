import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { unlockSchema } from "@/lib/validation/unlock";
import { distanceMeters } from "@/lib/geo";

const WINDOW_BEFORE_MS = 5 * 60 * 1000;
const WINDOW_AFTER_MS = 65 * 60 * 1000; // 1hr slot + 5min grace

// Matches GymFlow's own existing requirement for general door access —
// GPS-based, hard gate (confirmed 2026-08-10, ROADMAP.md Stage 7). Not
// tamper-proof (self-reported device location, same as GymFlow's), but
// consistent with what already protects the rest of the building.
export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid location data." }, { status: 400 });
  }
  const { latitude, longitude } = parsed.data;

  const rateLimit = await checkRateLimit(user.id, "/api/unlock");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const kisiKey = process.env.KISI_API_KEY;
  if (!kisiKey) {
    throw new Error("KISI_API_KEY is not configured");
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: bookings, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("member_id", member.id)
    .eq("status", "booked");

  if (bookingError) {
    return NextResponse.json({ status: "error", message: "Could not look up bookings." }, { status: 500 });
  }

  const now = Date.now();
  const active = (bookings ?? []).find((b) => {
    const start = new Date(b.slot_start).getTime();
    return now >= start - WINDOW_BEFORE_MS && now <= start + WINDOW_AFTER_MS;
  });

  if (!active) {
    return NextResponse.json({ status: "error", message: "No active booking right now." }, { status: 403 });
  }

  const { data: mapping, error: mapError } = await admin
    .from("gym_kisi_mapping")
    .select("*")
    .eq("gym", active.gym)
    .single();

  if (mapError || !mapping) {
    return NextResponse.json({ status: "error", message: "This gym has no door configured yet." }, { status: 500 });
  }

  // Hard gate on location — see the note above the route. Only checked
  // when the gym has coordinates configured (single-gym pilot: always
  // true for Aylesbury Berryfields, but a newly added gym without them
  // yet shouldn't be unable to unlock at all). distanceToGym is carried
  // through to the pod_access_events insert below so successful unlocks
  // get the same audit trail as blocked ones.
  let distanceToGym: number | undefined;
  if (mapping.latitude !== null && mapping.longitude !== null) {
    if (latitude === undefined || longitude === undefined) {
      await admin.from("pod_access_events").insert({
        booking_id: active.id,
        member_id: member.id,
        success: false,
        kisi_response: "blocked: no location provided",
      });
      return NextResponse.json(
        { status: "error", message: "Turn on location services to unlock the door." },
        { status: 403 }
      );
    }

    distanceToGym = distanceMeters(
      { latitude, longitude },
      { latitude: mapping.latitude, longitude: mapping.longitude }
    );

    if (distanceToGym > mapping.unlock_radius_meters) {
      await admin.from("pod_access_events").insert({
        booking_id: active.id,
        member_id: member.id,
        success: false,
        kisi_response: `blocked: too far (${Math.round(distanceToGym)}m > ${mapping.unlock_radius_meters}m)`,
        reported_latitude: latitude,
        reported_longitude: longitude,
        distance_meters: distanceToGym,
      });
      return NextResponse.json(
        { status: "error", message: "You need to be at the gym to unlock the door." },
        { status: 403 }
      );
    }
  }

  // Wrapped: a thrown error here (network failure, DNS, timeout) used to
  // skip the pod_access_events insert below entirely, leaving a failed
  // unlock attempt with zero audit trail — found live when an attempt
  // failed and the log had nothing to show for it.
  let success = false;
  let kisiResponse: string;
  try {
    const res = await fetch(`https://api.kisi.io/locks/${mapping.kisi_lock_id}/unlock`, {
      method: "POST",
      headers: {
        Authorization: `KISI-LOGIN ${kisiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    success = res.ok;
    kisiResponse = success ? "200 OK" : `${res.status} ${res.statusText}: ${await res.text()}`;
  } catch (err) {
    kisiResponse = `request failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  await admin.from("pod_access_events").insert({
    booking_id: active.id,
    member_id: member.id,
    success,
    kisi_response: kisiResponse,
    reported_latitude: latitude ?? null,
    reported_longitude: longitude ?? null,
    distance_meters: distanceToGym ?? null,
  });

  if (!success) {
    return NextResponse.json({ status: "error", message: "Unlock failed. Try again." }, { status: 502 });
  }

  return NextResponse.json({ status: "ok" });
}
