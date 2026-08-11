import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { redeemVoucherSchema } from "@/lib/validation/gift-voucher";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/vouchers/redeem");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = redeemVoucherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Enter a voucher code." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: voucher, error: lookupError } = await admin
    .from("gift_vouchers")
    .select("*")
    .eq("code", parsed.data.code)
    .maybeSingle();

  if (lookupError) {
    console.error("[vouchers-redeem] lookup failed", { error: lookupError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  if (!voucher) {
    return NextResponse.json({ status: "error", message: "That code isn't valid." }, { status: 404 });
  }

  if (voucher.redeemed_by_member_id) {
    return NextResponse.json({ status: "error", message: "That code has already been redeemed." }, { status: 409 });
  }

  // Mark redeemed first, conditioned on it still being unredeemed — the
  // `.is("redeemed_by_member_id", null)` filter makes this an atomic
  // claim: if two requests race for the same code, only the one whose
  // UPDATE actually matches a row (still-null) wins; the loser's update
  // affects zero rows rather than both silently succeeding and double-
  // granting credits for one voucher.
  const { data: claimed, error: claimError } = await admin
    .from("gift_vouchers")
    .update({ redeemed_by_member_id: member.id, redeemed_at: new Date().toISOString() })
    .eq("code", parsed.data.code)
    .is("redeemed_by_member_id", null)
    .select()
    .maybeSingle();

  if (claimError) {
    console.error("[vouchers-redeem] claim failed", { error: claimError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  if (!claimed) {
    return NextResponse.json({ status: "error", message: "That code has already been redeemed." }, { status: 409 });
  }

  const { error: creditError } = await admin.from("credits").insert({
    member_id: member.id,
    amount: claimed.credits,
    reason: "gift_voucher",
  });

  if (creditError) {
    console.error("[vouchers-redeem] failed to grant credits after claiming voucher", {
      error: creditError.message,
      code: parsed.data.code,
    });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", credits: claimed.credits });
}
