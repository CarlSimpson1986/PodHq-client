import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { getGymStripeAccountId } from "@/lib/data/stripe-config";
import { checkoutVoucherSchema } from "@/lib/validation/gift-voucher";
import { generateVoucherCode, creditsForVoucherAmount } from "@/lib/gift-voucher";

// The code is generated here, before payment, so the success page can show
// it immediately without waiting on the webhook — but it's only ever
// inserted into gift_vouchers by the webhook once Stripe actually confirms
// payment (checkout.session.completed). An abandoned/failed checkout means
// the code shown here was never real to begin with; nothing spendable
// exists until the webhook runs.
export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/checkout-voucher");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = checkoutVoucherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Enter a valid voucher amount." }, { status: 400 });
  }
  const { amountGBP } = parsed.data;

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const code = generateVoucherCode();
  const credits = creditsForVoucherAmount(amountGBP);

  const origin = request.nextUrl.origin;
  const stripe = getStripeClient();
  const stripeAccountId = await getGymStripeAccountId(member.gym);
  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(amountGBP * 100),
            product_data: { name: `Gift Voucher — £${amountGBP.toFixed(2)}` },
          },
        },
      ],
      metadata: {
        type: "gift_voucher",
        code,
        amount_gbp: String(amountGBP),
        credits: String(credits),
        purchaser_member_id: String(member.id),
      },
      success_url: `${origin}/gift-voucher/success?code=${code}`,
      cancel_url: `${origin}/gift-voucher?purchase=cancelled`,
    },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
  );

  if (!checkoutSession.url) {
    return NextResponse.json({ status: "error", message: "Could not start checkout." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", url: checkoutSession.url });
}
