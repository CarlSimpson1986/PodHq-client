import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { MEMBERSHIP_TIERS } from "@/lib/membership-tiers";
import { checkoutMembershipSchema } from "@/lib/validation/checkout-membership";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/checkout-membership");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = checkoutMembershipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const tier = MEMBERSHIP_TIERS.find((t) => t.id === parsed.data.tierId);
  if (!tier) {
    return NextResponse.json({ status: "error", message: "Unknown membership tier." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  // One active membership at a time — a member switching tiers cancels the
  // old subscription in Stripe first (out of scope here: no cancel/upgrade
  // flow yet, matches this app's pilot-scope pattern of building what's
  // asked for first).
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("memberships")
    .select("status")
    .eq("member_id", member.id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { status: "error", message: "You already have an active membership." },
      { status: 409 }
    );
  }

  const origin = request.nextUrl.origin;
  const stripe = getStripeClient();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(tier.priceGBP * 100),
          recurring: { interval: "month" },
          product_data: { name: `${tier.name} — ${tier.label}` },
        },
      },
    ],
    // Read back by the webhook (via the subscription object, not this
    // session's own metadata — invoice.payment_succeeded doesn't carry the
    // Checkout Session's metadata directly) to know who to credit, by how
    // much, and which tier they're on.
    subscription_data: {
      metadata: {
        member_id: String(member.id),
        tier_id: tier.id,
        tier_name: tier.name,
        credits_per_period: String(tier.creditsPerPeriod),
      },
    },
    success_url: `${origin}/book?membership=success`,
    cancel_url: `${origin}/buy-membership?membership=cancelled`,
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ status: "error", message: "Could not start checkout." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", url: checkoutSession.url });
}
