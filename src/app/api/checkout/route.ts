import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import { CREDIT_PACKAGES } from "@/lib/credit-packages";
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

  const pkg = CREDIT_PACKAGES.find((p) => p.id === parsed.data.packageId);
  if (!pkg) {
    return NextResponse.json({ status: "error", message: "Unknown credit package." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const origin = request.nextUrl.origin;
  const stripe = getStripeClient();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(pkg.priceGBP * 100),
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
    },
    success_url: `${origin}/book?purchase=success`,
    cancel_url: `${origin}/buy-credits?purchase=cancelled`,
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ status: "error", message: "Could not start checkout." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", url: checkoutSession.url });
}
