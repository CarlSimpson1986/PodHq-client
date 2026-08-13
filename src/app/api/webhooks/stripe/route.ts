import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";
import { notifyFireAndForget } from "@/lib/notifications/core";
import { resolveMemberContact } from "@/lib/notifications/resolve-member-contact";
import { getStaffRecipients } from "@/lib/notifications/staff-recipients";
import {
  creditPackPurchasedEmail,
  giftVoucherPurchasedEmail,
  staffGiftVoucherPurchasedEmail,
  membershipStartedEmail,
  membershipRenewedEmail,
  staffMembershipCancelledEmail,
} from "@/lib/notifications/templates";

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

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;

    // Subscription checkouts (memberships) are credited by invoice.payment_
    // succeeded instead, since that's what also fires on renewal — this
    // event only handles the one-off credit-pack purchase flow.
    if (checkoutSession.mode === "subscription") {
      return NextResponse.json({ status: "ok" });
    }

    if (checkoutSession.metadata?.type === "gift_voucher") {
      const code = checkoutSession.metadata.code;
      const amountGBP = Number(checkoutSession.metadata.amount_gbp);
      const voucherCredits = Number(checkoutSession.metadata.credits);
      const purchaserMemberId = Number(checkoutSession.metadata.purchaser_member_id);

      if (!code || !amountGBP || !voucherCredits || !purchaserMemberId) {
        console.error("[stripe-webhook] completed voucher session missing metadata", { sessionId: checkoutSession.id });
        return NextResponse.json({ status: "error", message: "Missing metadata." }, { status: 400 });
      }

      const { error } = await admin.from("gift_vouchers").insert({
        code,
        amount_gbp: amountGBP,
        credits: voucherCredits,
        purchaser_member_id: purchaserMemberId,
        stripe_event_id: event.id,
      });

      // Same retry tolerance as every other webhook-driven insert here —
      // a redelivered event is a no-op (23505 on stripe_event_id), not a
      // second voucher for one payment.
      if (error && error.code !== "23505") {
        console.error("[stripe-webhook] failed to record gift voucher", { error: error.message });
        return NextResponse.json({ status: "error", message: "Could not record voucher." }, { status: 500 });
      }

      // Only email on a genuinely fresh insert, not a retried delivery —
      // a redelivered event must not re-send a receipt for a payment the
      // purchaser already got emailed about.
      if (!error) {
        const purchaser = await resolveMemberContact(purchaserMemberId);
        if (purchaser) {
          const purchaserEmail = giftVoucherPurchasedEmail({
            memberName: purchaser.name,
            code,
            amountGBP,
            credits: voucherCredits,
          });
          await notifyFireAndForget({
            eventType: "gift_voucher_purchased",
            to: purchaser.email,
            subject: purchaserEmail.subject,
            html: purchaserEmail.html,
            memberId: purchaserMemberId,
          });

          const staffEmails = await getStaffRecipients(purchaser.gym);
          const staffEmail = staffGiftVoucherPurchasedEmail({
            purchaserName: purchaser.name,
            gym: purchaser.gym,
            amountGBP,
          });
          for (const to of staffEmails) {
            await notifyFireAndForget({
              eventType: "staff_gift_voucher_purchased",
              to,
              subject: staffEmail.subject,
              html: staffEmail.html,
            });
          }
        }
      }

      return NextResponse.json({ status: "ok" });
    }

    const memberId = Number(checkoutSession.metadata?.member_id);
    const credits = Number(checkoutSession.metadata?.credits);

    if (!memberId || !credits) {
      console.error("[stripe-webhook] completed session missing metadata", { sessionId: checkoutSession.id });
      return NextResponse.json({ status: "error", message: "Missing metadata." }, { status: 400 });
    }

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

    // Only email on a fresh insert — a retried delivery already got its
    // receipt the first time.
    if (!error) {
      const contact = await resolveMemberContact(memberId);
      if (contact) {
        const { subject, html } = creditPackPurchasedEmail({ memberName: contact.name, credits });
        await notifyFireAndForget({
          eventType: "credit_pack_purchased",
          to: contact.email,
          subject,
          html,
          memberId,
        });
      }
    }
  }

  if (event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const memberId = Number(subscription.metadata?.member_id);
    const tierId = subscription.metadata?.tier_id;
    const tierName = subscription.metadata?.tier_name;
    const creditsPerPeriod = Number(subscription.metadata?.credits_per_period);

    if (!memberId || !tierId || !tierName || !creditsPerPeriod) {
      console.error("[stripe-webhook] new subscription missing metadata", { subscriptionId: subscription.id });
      return NextResponse.json({ status: "error", message: "Missing metadata." }, { status: 400 });
    }

    // Upsert on member_id, not a plain insert: member_id is unique (one row
    // per member), so a member's *new* subscription after a previous one
    // was canceled has the same conflict shape as a *retried* webhook
    // delivery — a plain insert can't tell those apart and would silently
    // drop the new subscription entirely (found live 2026-08-11: a second
    // real subscription's credits were granted correctly by the invoice
    // handler below, but this table kept showing the old canceled tier,
    // since the insert's 23505 was swallowed as "just a retry").
    const { error } = await admin.from("memberships").upsert(
      {
        member_id: memberId,
        tier_id: tierId,
        tier_name: tierName,
        credits_per_period: creditsPerPeriod,
        stripe_subscription_id: subscription.id,
        status: normalizeStatus(subscription.status),
        current_period_end: periodEndIso(subscription),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" }
    );

    if (error) {
      console.error("[stripe-webhook] failed to record membership", { error: error.message });
      return NextResponse.json({ status: "error", message: "Could not record membership." }, { status: 500 });
    }

    const contact = await resolveMemberContact(memberId);
    if (contact) {
      const { subject, html } = membershipStartedEmail({
        memberName: contact.name,
        tierName,
        creditsPerPeriod,
      });
      await notifyFireAndForget({ eventType: "membership_started", to: contact.email, subject, html, memberId });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : normalizeStatus(subscription.status);

    const { error } = await admin
      .from("memberships")
      .update({ status, current_period_end: periodEndIso(subscription), updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscription.id);

    if (error) {
      console.error("[stripe-webhook] failed to update membership status", { error: error.message });
      return NextResponse.json({ status: "error", message: "Could not update membership." }, { status: 500 });
    }

    // Only a genuine cancellation gets a staff alert — not every status
    // change (e.g. a plain past_due transition on the same "updated" event).
    if (event.type === "customer.subscription.deleted") {
      const memberId = Number(subscription.metadata?.member_id);
      const tierName = subscription.metadata?.tier_name;
      if (memberId && tierName) {
        const contact = await resolveMemberContact(memberId);
        if (contact) {
          const staffEmails = await getStaffRecipients(contact.gym);
          const { subject, html } = staffMembershipCancelledEmail({
            memberName: contact.name,
            gym: contact.gym,
            tierName,
          });
          for (const to of staffEmails) {
            await notifyFireAndForget({ eventType: "staff_membership_cancelled", to, subject, html });
          }
        }
      }
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.parent?.subscription_details?.subscription;

    // Only subscription invoices (memberships) grant credits here — a
    // one-off credit-pack purchase has no subscription and is credited by
    // checkout.session.completed above instead.
    if (subscriptionId) {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(
        typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id
      );
      const memberId = Number(subscription.metadata?.member_id);
      const creditsPerPeriod = Number(subscription.metadata?.credits_per_period);

      if (!memberId || !creditsPerPeriod) {
        console.error("[stripe-webhook] paid invoice missing subscription metadata", { invoiceId: invoice.id });
        return NextResponse.json({ status: "error", message: "Missing metadata." }, { status: 400 });
      }

      const { error } = await admin.from("credits").insert({
        member_id: memberId,
        amount: creditsPerPeriod,
        reason: "membership",
        stripe_event_id: event.id,
      });

      // Fires for both the first payment and every renewal — stripe_event_id
      // is unique per Stripe event, so a redelivered event is a no-op here
      // too, same reasoning as the one-off purchase path above.
      if (error && error.code !== "23505") {
        console.error("[stripe-webhook] failed to grant membership credits", { error: error.message });
        return NextResponse.json({ status: "error", message: "Could not grant credits." }, { status: 500 });
      }

      // customer.subscription.created (above) already emails
      // membership_started, and Stripe always invoices the first period
      // too — without this gate a brand-new member would get both emails
      // seconds apart. billing_reason distinguishes a real renewal
      // ("subscription_cycle") from that first invoice
      // ("subscription_create"). The credit grant itself stays
      // unconditional either way — only the email is gated.
      if (!error && invoice.billing_reason === "subscription_cycle") {
        const contact = await resolveMemberContact(memberId);
        if (contact) {
          const tierName = subscription.metadata?.tier_name ?? "";
          const { subject, html } = membershipRenewedEmail({
            memberName: contact.name,
            tierName,
            creditsPerPeriod,
          });
          await notifyFireAndForget({ eventType: "membership_renewed", to: contact.email, subject, html, memberId });
        }
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}

// Stripe subscription statuses (incomplete, incomplete_expired, trialing,
// unpaid, paused, ...) are broader than this app's memberships.status CHECK
// (active/past_due/canceled) — narrowed here rather than widening the DB
// constraint to every Stripe status this pilot never expects to hit.
function normalizeStatus(stripeStatus: Stripe.Subscription.Status): "active" | "past_due" | "canceled" {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due") return "past_due";
  return "canceled";
}

// current_period_end lives on the subscription item, not the subscription
// itself, in this Stripe API version.
function periodEndIso(subscription: Stripe.Subscription): string | null {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}
