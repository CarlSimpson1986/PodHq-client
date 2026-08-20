import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { getGymStripeAccountId } from "@/lib/data/stripe-config";
import { getMembershipTierById } from "@/lib/data/catalog";
import { findApplicableCoupon, redeemCoupon, applyDiscount } from "@/lib/data/coupons";
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

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const tier = await getMembershipTierById(member.gym, parsed.data.tierId);
  if (!tier) {
    return NextResponse.json({ status: "error", message: "Unknown membership tier." }, { status: 400 });
  }

  const stripe = getStripeClient();
  // A gym with its own Stripe Connect account (Hove onward) gets the
  // subscription created directly against that account. null (no
  // connected account yet) falls back to the platform account exactly as
  // every gym behaved before Connect existed.
  const stripeAccountId = await getGymStripeAccountId(member.gym);
  const stripeOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;

  // One active membership at a time. Same tier again is just a no-op
  // resubscribe attempt — block it. A genuinely different tier is a real
  // upgrade/downgrade: cancel the old subscription first, then let the
  // new Checkout Session below start the new one. Immediate cancellation,
  // not cancel_at_period_end — same behaviour as Profile's own Cancel
  // button, no proration/credit for the unused portion of the old tier's
  // period. The memberships row itself isn't updated here; the existing
  // customer.subscription.deleted webhook handler does that once Stripe
  // confirms the cancellation, same as every other Stripe-driven state
  // change in this app.
  const existing = await getActiveMembership(member.id);
  if (existing) {
    if (existing.tier_id === tier.id) {
      return NextResponse.json({ status: "error", message: "You're already on this plan." }, { status: 409 });
    }
    try {
      await stripe.subscriptions.cancel(existing.stripe_subscription_id, {}, stripeOptions);
    } catch (err) {
      console.error("[checkout-membership] failed to cancel existing subscription for switch", {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { status: "error", message: "Could not switch plans. Try again." },
        { status: 500 }
      );
    }
  }

  // Claimed atomically now (before payment) via redeem_coupon() — see
  // podHq's 0044_coupons.sql. Applied to the recurring price directly
  // (every renewal, not just the first payment) — simplest behaviour,
  // matching how the Founding Member PAYG discount already works; revisit
  // if a first-payment-only promo is ever actually needed.
  let priceGBP = tier.priceGBP;
  if (parsed.data.couponCode) {
    const coupon = await findApplicableCoupon(member.gym, parsed.data.couponCode, tier.catalogItemId);
    if (!coupon) {
      return NextResponse.json({ status: "error", message: "That coupon code isn't valid for this item." }, { status: 400 });
    }
    const claimed = await redeemCoupon(coupon.id, member.id, tier.catalogItemId);
    if (!claimed) {
      return NextResponse.json({ status: "error", message: "That coupon has already been used or is no longer available." }, { status: 409 });
    }
    priceGBP = applyDiscount(tier.priceGBP, coupon);
  }

  const origin = request.nextUrl.origin;
  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(priceGBP * 100),
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
          credit_type: tier.creditType,
          // Combo tiers only — read back by the webhook on every renewal,
          // since credit_type is never stored on the memberships row
          // itself. See podHq's 0042_catalog_items_combo_credits.sql.
          ...(tier.creditsPerPeriodSecondary && tier.creditTypeSecondary
            ? { credits_per_period_secondary: String(tier.creditsPerPeriodSecondary), credit_type_secondary: tier.creditTypeSecondary }
            : {}),
        },
      },
      success_url: `${origin}/book?membership=success`,
      cancel_url: `${origin}/buy-membership?membership=cancelled`,
    },
    stripeOptions
  );

  if (!checkoutSession.url) {
    return NextResponse.json({ status: "error", message: "Could not start checkout." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", url: checkoutSession.url });
}
