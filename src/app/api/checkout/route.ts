import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { getGymStripeAccountId } from "@/lib/data/stripe-config";
import { getCreditPackageById, hasMemberClaimedItem } from "@/lib/data/catalog";
import { findApplicablePromoCode, redeemPromoCode, applyDiscount } from "@/lib/data/promo-codes";
import { checkoutSchema } from "@/lib/validation/checkout";
import { GYM_NAMES } from "@/lib/gym";

function isGymName(value: string): value is (typeof GYM_NAMES)[number] {
  return (GYM_NAMES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/checkout");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  // Which gym's catalog/Stripe account this purchase actually goes
  // through — the gym the member was browsing (?gym= on /buy-credits,
  // carried from /book's "Buy more" link), not always their home gym.
  // Falls back to home gym if absent or not a real gym name, so a plain
  // link to /buy-credits with no param behaves exactly as before this
  // change.
  const gym = parsed.data.gym && isGymName(parsed.data.gym) ? parsed.data.gym : member.gym;

  const pkg = await getCreditPackageById(gym, parsed.data.packageId);
  if (!pkg) {
    return NextResponse.json({ status: "error", message: "Unknown credit package." }, { status: 400 });
  }

  // Self-service only — staff can still sell/grant this again via podHq
  // regardless (staff discretion, not enforced there).
  if (pkg.oneTimePerMember && (await hasMemberClaimedItem(member.id, pkg.id))) {
    return NextResponse.json(
      { status: "error", message: "This is a one-time offer — you've already claimed it." },
      { status: 409 }
    );
  }

  // A promo code the member typed in takes priority over either automatic
  // discount below rather than stacking — an explicit code is a
  // deliberate choice, both automatic discounts are passive. Founding
  // Member (20% off, permanent) takes priority over the subscriber
  // top-up discount (10% off, 2026-08-26) rather than stacking the two —
  // simplest rule, and a founding member's discount is already the
  // bigger one. The subscriber discount itself doesn't check what this
  // credit will actually be spent on — the webhook route separately
  // decides whether it lands as network (cross-gym) or base (home-gym)
  // credit purely from current membership status, unrelated to price.
  // Claimed atomically now (before payment) via redeem_promo_code() — see
  // podHq's 0044_promo_codes.sql for the accepted abandoned-checkout tradeoff.
  let priceGBP = pkg.priceGBP;
  if (member.founding_member) {
    priceGBP = pkg.priceGBP * 0.8;
  } else if (await getActiveMembership(member.id)) {
    priceGBP = pkg.priceGBP * 0.9;
  }
  if (parsed.data.promoCode) {
    const promoCode = await findApplicablePromoCode(gym, parsed.data.promoCode, pkg.catalogItemId);
    if (!promoCode) {
      return NextResponse.json({ status: "error", message: "That promo code isn't valid for this item." }, { status: 400 });
    }
    const claimed = await redeemPromoCode(promoCode.id, member.id, pkg.catalogItemId);
    if (!claimed) {
      return NextResponse.json({ status: "error", message: "That promo code has already been used or is no longer available." }, { status: 409 });
    }
    priceGBP = applyDiscount(pkg.priceGBP, promoCode);
  }

  const origin = request.nextUrl.origin;
  const stripe = getStripeClient();
  // A gym with its own Stripe Connect account (Hove onward) gets the
  // Checkout Session created directly against that account — money and
  // Stripe's processing fee land there, not on the shared platform
  // account. null (no connected account yet) falls back to the platform
  // account exactly as every gym behaved before Connect existed. Uses
  // the resolved `gym` (not member.gym) — this is the actual point of
  // today's fix: buying while browsing another gym pays that gym, not
  // always home.
  const stripeAccountId = await getGymStripeAccountId(gym);
  // Carries the purchase-gym back through so a member who bought credit
  // to spend at another gym lands back on that gym's /book view, not
  // their own — they'd otherwise have to re-select it after paying.
  const bookRedirect = gym === member.gym ? "/book" : `/book?gym=${encodeURIComponent(gym)}`;
  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(priceGBP * 100),
            product_data: { name: `${pkg.name} — ${pkg.label}` },
          },
        },
      ],
      // Read back by the webhook to know who to credit and by how much —
      // the webhook has no session/cookie context of its own (it's Stripe's
      // server calling us, not the member's browser).
      metadata: {
        member_id: String(member.id),
        credits: String(pkg.credits),
        packageId: pkg.id,
        creditType: pkg.creditType,
      },
      success_url: `${origin}${bookRedirect}${bookRedirect.includes("?") ? "&" : "?"}purchase=success`,
      cancel_url: `${origin}/buy-credits?purchase=cancelled${gym !== member.gym ? `&gym=${encodeURIComponent(gym)}` : ""}`,
    },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );

  if (!checkoutSession.url) {
    return NextResponse.json({ status: "error", message: "Could not start checkout." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", url: checkoutSession.url });
}
