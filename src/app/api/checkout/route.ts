import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { getGymStripeAccountId } from "@/lib/data/stripe-config";
import { getCreditPackageById, hasMemberClaimedItem } from "@/lib/data/catalog";
import { checkoutSchema } from "@/lib/validation/checkout";

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

  const pkg = await getCreditPackageById(member.gym, parsed.data.packageId);
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

  const origin = request.nextUrl.origin;
  const stripe = getStripeClient();
  // A gym with its own Stripe Connect account (Hove onward) gets the
  // Checkout Session created directly against that account — money and
  // Stripe's processing fee land there, not on the shared platform
  // account. null (no connected account yet) falls back to the platform
  // account exactly as every gym behaved before Connect existed.
  const stripeAccountId = await getGymStripeAccountId(member.gym);
  // Hove's Founding Member offer — 20% off every PAYG purchase, applied
  // automatically here (never a code the member enters). See podHq's
  // 0043_founding_member.sql — staff-granted only, revoked on cancel.
  const priceGBP = member.founding_member ? pkg.priceGBP * 0.8 : pkg.priceGBP;
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
      success_url: `${origin}/book?purchase=success`,
      cancel_url: `${origin}/buy-credits?purchase=cancelled`,
    },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );

  if (!checkoutSession.url) {
    return NextResponse.json({ status: "error", message: "Could not start checkout." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", url: checkoutSession.url });
}
