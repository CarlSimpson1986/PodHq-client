import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";

// Called by Stripe's servers, not a member's browser — no session cookie
// exists here, so this route (unlike every other route in this app) skips
// the createSessionClient()/getUser() pattern entirely and authenticates
// the caller via Stripe's signature instead. Listed in proxy.ts's
// PUBLIC_API_PREFIXES so the auth gate doesn't redirect it to /login.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ status: "error", message: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const memberId = Number(checkoutSession.metadata?.member_id);
    const credits = Number(checkoutSession.metadata?.credits);

    if (!memberId || !credits) {
      console.error("[stripe-webhook] completed session missing metadata", { sessionId: checkoutSession.id });
      return NextResponse.json({ status: "error", message: "Missing metadata." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("credits").insert({
      member_id: memberId,
      amount: credits,
      reason: "purchase",
      stripe_event_id: event.id,
    });

    // Stripe retries delivery on anything but a 2xx, so this must tolerate
    // being called more than once for the same event. The unique constraint
    // on stripe_event_id turns a retried delivery into a no-op (23505)
    // instead of crediting the member twice for one payment.
    if (error && error.code !== "23505") {
      console.error("[stripe-webhook] failed to record purchase", { error: error.message });
      return NextResponse.json({ status: "error", message: "Could not record purchase." }, { status: 500 });
    }
  }

  return NextResponse.json({ status: "ok" });
}
