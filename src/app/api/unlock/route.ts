import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId, isAccessComplete } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { unlockSchema } from "@/lib/validation/unlock";
import { distanceMeters } from "@/lib/geo";
import { isWithinUnlockWindow } from "@/lib/unlock-window";

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
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }
  const { bookingId, latitude, longitude } = parsed.data;

  const rateLimit = await checkRateLimit(user.id, "/api/unlock");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Looks up the specific booking the client identified, not "the" active
  // booking inferred from a time-window scan across all of the member's
  // bookings — that inference was non-deterministic once a member could
  // have two genuinely overlapping bookings across two different
  // resources (see 0038_pod_resources.sql). member_id + status='booked' in
  // the query itself doubles as the ownership check.
  const { data: active, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("member_id", member.id)
    .eq("status", "booked")
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json({ status: "error", message: "Could not look up booking." }, { status: 500 });
  }
  if (!active) {
    return NextResponse.json({ status: "error", message: "Booking not found." }, { status: 404 });
  }

  // Fetched before the window check below — the unlock window's length
  // depends on this resource's own slot duration (30 min for Hove's
  // Recovery Room, 60 min elsewhere), not a flat assumption.
  const { data: resource, error: resourceError } = await admin
    .from("pod_resources")
    .select("*")
    .eq("id", active.resource_id)
    .maybeSingle();

  if (resourceError || !resource) {
    return NextResponse.json({ status: "error", message: "This door has no lock configured yet." }, { status: 500 });
  }

  const now = Date.now();
  const start = new Date(active.slot_start).getTime();
  if (!isWithinUnlockWindow(now, start, resource.slot_duration_minutes)) {
    return NextResponse.json({ status: "error", message: "No active booking right now." }, { status: 403 });
  }

  // Server-side mirror of the client-side gate in booking-grid.tsx —
  // never trust a client-side-only check for the physical door, same
  // reasoning as the location gate below.
  if (!isAccessComplete(member)) {
    await admin.from("pod_access_events").insert({
      booking_id: active.id,
      member_id: member.id,
      success: false,
      kisi_response: "blocked: access onboarding incomplete",
    });
    return NextResponse.json(
      { status: "error", message: "Finish your Access details in Profile to unlock the door." },
      { status: 403 }
    );
  }

  // Hard gate on location — see the note above the route. Only checked
  // when the resource has coordinates configured (single-gym pilot:
  // always true for Aylesbury Berryfields, but a newly added resource
  // without them yet shouldn't be unable to unlock at all). distanceToGym
  // is carried through to the pod_access_events insert below so
  // successful unlocks get the same audit trail as blocked ones.
  let distanceToGym: number | undefined;
  if (resource.latitude !== null && resource.longitude !== null) {
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
      { latitude: resource.latitude, longitude: resource.longitude }
    );

    if (distanceToGym > resource.unlock_radius_meters) {
      await admin.from("pod_access_events").insert({
        booking_id: active.id,
        member_id: member.id,
        success: false,
        kisi_response: `blocked: too far (${Math.round(distanceToGym)}m > ${resource.unlock_radius_meters}m)`,
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

  // PDK (ProdataKey) resources — Brighton, confirmed live 2026-08-17 — are
  // deliberately not integrated yet: PDK's real API shape is unconfirmed
  // anywhere in this repo, and guessing at it against a physical door lock
  // isn't acceptable. Fails closed with a clear message rather than a
  // fabricated API call. See podHq's ROADMAP "PDK integration" note.
  if (resource.access_provider === "pdk") {
    await admin.from("pod_access_events").insert({
      booking_id: active.id,
      member_id: member.id,
      success: false,
      kisi_response: "blocked: PDK integration not yet built",
      reported_latitude: latitude ?? null,
      reported_longitude: longitude ?? null,
      distance_meters: distanceToGym ?? null,
    });
    return NextResponse.json({ status: "error", message: "This door isn't set up yet — contact staff." }, { status: 500 });
  }

  if (!resource.kisi_lock_id) {
    await admin.from("pod_access_events").insert({
      booking_id: active.id,
      member_id: member.id,
      success: false,
      kisi_response: "blocked: no Kisi lock configured for this resource",
      reported_latitude: latitude ?? null,
      reported_longitude: longitude ?? null,
      distance_meters: distanceToGym ?? null,
    });
    return NextResponse.json({ status: "error", message: "This door isn't set up yet — contact staff." }, { status: 500 });
  }

  const kisiKey = process.env.KISI_API_KEY;
  if (!kisiKey) {
    throw new Error("KISI_API_KEY is not configured");
  }

  // Wrapped: a thrown error here (network failure, DNS, timeout) used to
  // skip the pod_access_events insert below entirely, leaving a failed
  // unlock attempt with zero audit trail — found live when an attempt
  // failed and the log had nothing to show for it.
  let success = false;
  let kisiResponse: string;
  try {
    const res = await fetch(`https://api.kisi.io/locks/${resource.kisi_lock_id}/unlock`, {
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
