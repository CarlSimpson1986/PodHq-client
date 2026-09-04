import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, getActiveMembership } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getGymStripeContext } from "@/lib/data/stripe-config";

// Immediate cancellation, not cancel_at_period_end — matches the exact
// behaviour already live-verified during Stage 8 testing (stripe
// subscriptions cancel), and keeps the memberships table's status column
// a simple reflection of Stripe's own subscription.status rather than
// needing a separate "cancels at period end" state the schema doesn't
// have yet. The DB row itself isn't updated here — customer.subscription.
// deleted (already handled in the webhook) is the source of truth, same
// pattern as every other Stripe-driven state change in this app.
export async function POST() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/membership/cancel");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const membership = await getActiveMembership(member.id);
  if (!membership) {
    return NextResponse.json({ status: "error", message: "No active membership to cancel." }, { status: 404 });
  }

  try {
    // Pre-existing gap fixed here: this previously always used the shared
    // platform client with no account routing at all, which would have
    // failed for any gym with its own Stripe account (standalone or
    // Connect) — the subscription only exists on that gym's own account.
    const { client: stripe, requestOptions } = await getGymStripeContext(member.gym);
    await stripe.subscriptions.cancel(membership.stripe_subscription_id, {}, requestOptions);
  } catch (err) {
    console.error("[membership-cancel] Stripe cancel failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ status: "error", message: "Could not cancel membership. Try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
