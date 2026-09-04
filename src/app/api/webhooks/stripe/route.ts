import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";
import { decryptSecret } from "@/lib/crypto/secret-encryption";
import { getActiveMembership, networkCreditType } from "@/lib/data/member";
import { getCreditPackageById } from "@/lib/data/catalog";
import { recordStripeRevenue } from "@/lib/data/record-revenue";
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
  // Stripe's "connect" flag is set once, at endpoint creation, and can't be
  // toggled on an existing endpoint — a gym's own Connect account (direct
  // charges via `stripeAccount`) delivers events under the "Connected
  // accounts" scope, which only a separate connect:true endpoint receives.
  // That endpoint has its own distinct signing secret, so this route has to
  // verify against both rather than the one shared secret originally assumed.
  const webhookSecretConnect = process.env.STRIPE_WEBHOOK_SECRET_CONNECT;

  if (!signature) {
    return NextResponse.json({ status: "error", message: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const platformStripe = getStripeClient();
  const admin = createAdminClient();

  let event: Stripe.Event | null = null;
  // Set only when the matched signature was a standalone gym's own
  // (see 0084_gym_stripe_standalone.sql) — that gym's own client must be
  // used for every follow-up call below instead of the platform client,
  // since the event never carries event.account (it's not a Connect
  // event) and the payment/subscription objects it references only exist
  // on that gym's own account.
  let standaloneClient: Stripe | null = null;
  // Set alongside standaloneClient — the real gym this event's own account
  // belongs to, read straight from the row whose secret matched. Used to
  // attribute Revenue rows correctly (see record-revenue.ts) rather than
  // guessing from member.gym, which can be wrong for a cross-gym purchase.
  let standaloneGym: string | null = null;

  if (webhookSecret) {
    try {
      event = platformStripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      // fall through to the next candidate secret
    }
  }
  if (!event && webhookSecretConnect) {
    try {
      event = platformStripe.webhooks.constructEvent(rawBody, signature, webhookSecretConnect);
    } catch {
      // fall through
    }
  }
  if (!event) {
    const { data: standaloneConfigs, error: standaloneError } = await admin
      .from("gym_stripe_config")
      .select("gym, api_key_encrypted, webhook_secret_encrypted")
      .not("api_key_encrypted", "is", null)
      .not("webhook_secret_encrypted", "is", null);
    if (!standaloneError) {
      for (const config of standaloneConfigs ?? []) {
        try {
          const candidateSecret = decryptSecret(config.webhook_secret_encrypted!);
          event = platformStripe.webhooks.constructEvent(rawBody, signature, candidateSecret);
          standaloneClient = new Stripe(decryptSecret(config.api_key_encrypted!));
          standaloneGym = config.gym;
          break;
        } catch {
          // not this gym's secret — try the next one
        }
      }
    }
  }

  if (!event) {
    return NextResponse.json({ status: "error", message: "Invalid signature." }, { status: 400 });
  }

  // Every *secondary* Stripe API call this handler makes below (retrieving
  // a PaymentIntent, a Subscription, listing Invoice Payments, updating a
  // Customer) must land on the same account the event itself came from —
  // a standalone gym's own client, or the platform client scoped to a
  // Connect account via connectRequestOptions, or the plain platform
  // client for a platform-account event. Resolving which member/gym a
  // payment belongs to doesn't depend on any of this — that's already
  // done via checkout/subscription metadata regardless of which account
  // processed the payment.
  const stripe = standaloneClient ?? platformStripe;
  const connectRequestOptions: Stripe.RequestOptions | undefined =
    !standaloneClient && event.account ? { stripeAccount: event.account } : undefined;

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
        stripe_payment_intent_id: resolvePaymentIntentId(checkoutSession.payment_intent),
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
          if (standaloneGym) {
            await recordStripeRevenue(
              standaloneGym,
              `Gift Voucher — £${amountGBP.toFixed(2)}`,
              amountGBP,
              "CREDIT_PACK",
              purchaser.name,
              event.created
            );
          }
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
            gym: purchaser.gym,
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
              gym: purchaser.gym,
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
      catalog_item_id: checkoutSession.metadata?.packageId ?? null,
      credit_type: await resolvePurchaseCreditType(
        memberId,
        checkoutSession.metadata?.creditType ?? "pod",
        checkoutSession.metadata?.networkEligible !== "false"
      ),
      stripe_event_id: event.id,
      stripe_payment_intent_id: resolvePaymentIntentId(checkoutSession.payment_intent),
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
        if (standaloneGym) {
          const packageId = checkoutSession.metadata?.packageId;
          const pkg = packageId ? await getCreditPackageById(standaloneGym, packageId) : null;
          await recordStripeRevenue(
            standaloneGym,
            pkg ? `${pkg.name} — ${pkg.label}` : (packageId ?? "Credit pack"),
            (checkoutSession.amount_total ?? 0) / 100,
            "CREDIT_PACK",
            contact.name,
            event.created
          );
        }
        const { subject, html } = creditPackPurchasedEmail({ memberName: contact.name, credits });
        await notifyFireAndForget({
          eventType: "credit_pack_purchased",
          to: contact.email,
          subject,
          html,
          memberId,
          gym: contact.gym,
        });
      }
    }

    // The payment method used isn't set as the customer's default just by
    // being attached (setup_future_usage attaches it, nothing more) — a
    // separate call to the PaymentIntent is needed to find which one was
    // actually used, since Checkout Sessions don't expose it directly.
    const paymentIntentId = resolvePaymentIntentId(checkoutSession.payment_intent);
    const usedPaymentMethodId = paymentIntentId
      ? resolvePaymentMethodId(
          (await stripe.paymentIntents.retrieve(paymentIntentId, undefined, connectRequestOptions)).payment_method
        )
      : null;
    await saveStripeCustomerId(admin, stripe, memberId, checkoutSession.customer, usedPaymentMethodId, connectRequestOptions);
  }

  // Staff-initiated "charge card on file" (podHq's /pods/members/[id] sell
  // panel) — a raw off-session PaymentIntent, no Checkout Session involved,
  // so checkout.session.completed never fires for it. Gated strictly on
  // metadata.source rather than just member_id/credits presence: Checkout
  // Session metadata doesn't propagate to its underlying PaymentIntent
  // unless payment_intent_data.metadata is explicitly set (which the normal
  // credit-pack checkout path here never does), so a plain Checkout payment
  // would fail this gate anyway — the explicit check is defense-in-depth
  // against ever double-crediting the same purchase from two event types.
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    if (paymentIntent.metadata?.source === "staff_saved_card") {
      const memberId = Number(paymentIntent.metadata.member_id);
      const credits = Number(paymentIntent.metadata.credits);

      if (!memberId || !credits) {
        console.error("[stripe-webhook] staff saved-card charge missing metadata", { paymentIntentId: paymentIntent.id });
        return NextResponse.json({ status: "error", message: "Missing metadata." }, { status: 400 });
      }

      const { error } = await admin.from("credits").insert({
        member_id: memberId,
        amount: credits,
        reason: "purchase",
        catalog_item_id: paymentIntent.metadata?.packageId ?? null,
        credit_type: await resolvePurchaseCreditType(
          memberId,
          paymentIntent.metadata?.creditType ?? "pod",
          paymentIntent.metadata?.networkEligible !== "false"
        ),
        stripe_event_id: event.id,
        stripe_payment_intent_id: paymentIntent.id,
      });

      if (error && error.code !== "23505") {
        console.error("[stripe-webhook] failed to record staff saved-card purchase", { error: error.message });
        return NextResponse.json({ status: "error", message: "Could not record purchase." }, { status: 500 });
      }

      if (!error) {
        const contact = await resolveMemberContact(memberId);
        if (contact) {
          if (standaloneGym) {
            const packageId = paymentIntent.metadata?.packageId;
            const pkg = packageId ? await getCreditPackageById(standaloneGym, packageId) : null;
            await recordStripeRevenue(
              standaloneGym,
              pkg ? `${pkg.name} — ${pkg.label}` : (packageId ?? "Credit pack"),
              paymentIntent.amount / 100,
              "CREDIT_PACK",
              contact.name,
              event.created
            );
          }
          const { subject, html } = creditPackPurchasedEmail({ memberName: contact.name, credits });
          await notifyFireAndForget({
            eventType: "credit_pack_purchased",
            to: contact.email,
            subject,
            html,
            memberId,
            gym: contact.gym,
          });
        }
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
      await notifyFireAndForget({ eventType: "membership_started", to: contact.email, subject, html, memberId, gym: contact.gym });
    }

    await saveStripeCustomerId(
      admin,
      stripe,
      memberId,
      subscription.customer,
      resolvePaymentMethodId(subscription.default_payment_method),
      connectRequestOptions
    );
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

      // Hove's Founding Member offer: "cancel = lose it permanently, no
      // re-entry." Unconditional — a no-op for members who were never
      // founding members. See podHq's 0043_founding_member.sql.
      if (memberId) {
        const { error: revokeError } = await admin.from("members").update({ founding_member: false }).eq("id", memberId);
        if (revokeError) {
          console.error("[stripe-webhook] failed to revoke founding member status", { error: revokeError.message, memberId });
        }
      }

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
            await notifyFireAndForget({ eventType: "staff_membership_cancelled", to, subject, html, gym: contact.gym });
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
      const subscription = await stripe.subscriptions.retrieve(
        typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id,
        undefined,
        connectRequestOptions
      );
      const memberId = Number(subscription.metadata?.member_id);
      const creditsPerPeriod = Number(subscription.metadata?.credits_per_period);

      if (!memberId || !creditsPerPeriod) {
        console.error("[stripe-webhook] paid invoice missing subscription metadata", { invoiceId: invoice.id });
        return NextResponse.json({ status: "error", message: "Missing metadata." }, { status: 400 });
      }

      // Invoice has no direct payment_intent field in this Stripe API
      // version (confirmed against the installed SDK's types — it was
      // replaced by the Invoice Payments API) — the default payment's
      // reference has to be looked up separately to store it for a future
      // refund.
      const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id }, connectRequestOptions);
      const defaultPayment = invoicePayments.data.find((p) => p.is_default) ?? invoicePayments.data[0];
      const paymentIntentId =
        defaultPayment?.payment.type === "payment_intent" ? resolvePaymentIntentId(defaultPayment.payment.payment_intent) : null;

      const { error } = await admin.from("credits").insert({
        member_id: memberId,
        amount: creditsPerPeriod,
        reason: "membership",
        credit_type: subscription.metadata?.credit_type ?? "pod",
        stripe_event_id: event.id,
        stripe_payment_intent_id: paymentIntentId,
      });

      // Fires for both the first payment and every renewal — stripe_event_id
      // is unique per Stripe event, so a redelivered event is a no-op here
      // too, same reasoning as the one-off purchase path above.
      if (error && error.code !== "23505") {
        console.error("[stripe-webhook] failed to grant membership credits", { error: error.message });
        return NextResponse.json({ status: "error", message: "Could not grant credits." }, { status: 500 });
      }

      // Unconditional on a fresh insert, same as the credit grant itself —
      // every real charge counts as revenue, first payment or renewal
      // alike, not just the ones that also happen to trigger an email
      // below.
      if (!error && standaloneGym) {
        const revenueContact = await resolveMemberContact(memberId);
        if (revenueContact) {
          const tierName = subscription.metadata?.tier_name ?? "Membership";
          await recordStripeRevenue(
            standaloneGym,
            tierName,
            (invoice.amount_paid ?? 0) / 100,
            "MEMBERSHIP",
            revenueContact.name,
            event.created
          );
        }
      }

      // Combo memberships grant a second credit type from the same
      // invoice — see 0042_catalog_items_combo_credits.sql (podHq repo).
      // A distinct stripe_event_id suffix, not event.id itself: the
      // primary insert above already claims event.id under the unique
      // constraint, so reusing it here would collide and silently skip
      // the secondary grant, not just guard against redelivery.
      const secondaryCredits = Number(subscription.metadata?.credits_per_period_secondary);
      const secondaryType = subscription.metadata?.credit_type_secondary;
      if (secondaryCredits && secondaryType) {
        const { error: secondaryError } = await admin.from("credits").insert({
          member_id: memberId,
          amount: secondaryCredits,
          reason: "membership",
          credit_type: secondaryType,
          stripe_event_id: `${event.id}:secondary`,
          stripe_payment_intent_id: paymentIntentId,
        });
        if (secondaryError && secondaryError.code !== "23505") {
          console.error("[stripe-webhook] failed to grant secondary membership credits", { error: secondaryError.message });
          return NextResponse.json({ status: "error", message: "Could not grant secondary credits." }, { status: 500 });
        }
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
          await notifyFireAndForget({ eventType: "membership_renewed", to: contact.email, subject, html, memberId, gym: contact.gym });
        }
      }
    }
  }

  // Staff-initiated refunds (podHq admin) call stripe.refunds.create()
  // directly against the original payment_intent — this event is Stripe
  // confirming it happened, and is the sole writer of the ledger
  // correction, same webhook-driven pattern every other money event here
  // already uses (never trust the refund-issuing request itself to also
  // touch the ledger).
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;

    // Partial refunds aren't supported yet (podHq only ever issues a full
    // refund) — a partially-refunded charge is logged, not silently
    // reflected as a full reversal in the ledger.
    if (!charge.refunded) {
      console.error("[stripe-webhook] partial refund not supported, skipping", { chargeId: charge.id });
      return NextResponse.json({ status: "ok" });
    }

    const paymentIntentId = resolvePaymentIntentId(charge.payment_intent);
    if (!paymentIntentId) {
      console.error("[stripe-webhook] refunded charge has no payment_intent", { chargeId: charge.id });
      return NextResponse.json({ status: "ok" });
    }

    const { data: originalCredit, error: lookupError } = await admin
      .from("credits")
      .select("member_id, amount, credit_type")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .in("reason", ["purchase", "membership"])
      .maybeSingle();

    if (lookupError) {
      console.error("[stripe-webhook] refund lookup failed", { error: lookupError.message });
      return NextResponse.json({ status: "error", message: "Could not record refund." }, { status: 500 });
    }

    if (originalCredit) {
      // stripe_event_id's unique constraint makes a redelivered event a
      // no-op here too — the original purchase row is never touched, so
      // reprocessing the same refund event would otherwise insert a
      // second negative row and double-claw-back the member's balance.
      const { error } = await admin.from("credits").insert({
        member_id: originalCredit.member_id,
        amount: -originalCredit.amount,
        reason: "refund",
        credit_type: originalCredit.credit_type,
        stripe_event_id: event.id,
        stripe_payment_intent_id: paymentIntentId,
      });

      if (error && error.code !== "23505") {
        console.error("[stripe-webhook] failed to record refund", { error: error.message });
        return NextResponse.json({ status: "error", message: "Could not record refund." }, { status: 500 });
      }

      return NextResponse.json({ status: "ok" });
    }

    // Not a credit purchase — check whether it's a gift voucher instead.
    // Conditioned on refunded_at still being null, same atomic-claim
    // pattern as voucher redemption, so a redelivered event is a harmless
    // no-op rather than needing its own idempotency key.
    const { error: voucherError } = await admin
      .from("gift_vouchers")
      .update({ refunded_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .is("refunded_at", null);

    if (voucherError) {
      console.error("[stripe-webhook] failed to record voucher refund", { error: voucherError.message });
      return NextResponse.json({ status: "error", message: "Could not record refund." }, { status: 500 });
    }
  }

  return NextResponse.json({ status: "ok" });
}

// Captures the Stripe Customer created/reused for a purchase so podHq's
// staff "sell a pack or membership" feature can later offer "charge card on
// file" instead of re-collecting card details every time (see podHq's
// 0028_member_stripe_customer.sql). Only ever set, never cleared — a
// member's customer id doesn't change just because a later purchase omits
// one (e.g. a guest checkout would have none), so this is a plain update
// guarded on customerId being present, not an unconditional overwrite.
async function saveStripeCustomerId(
  admin: ReturnType<typeof createAdminClient>,
  stripe: Stripe,
  memberId: number,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
  defaultPaymentMethodId: string | null,
  requestOptions?: Stripe.RequestOptions
) {
  if (!customer) return;
  const customerId = typeof customer === "string" ? customer : customer.id;

  const { error } = await admin.from("members").update({ stripe_customer_id: customerId }).eq("id", memberId);
  if (error) {
    console.error("[stripe-webhook] failed to save stripe_customer_id", { memberId, error: error.message });
  }

  // Attaching a payment method to a Customer (via setup_future_usage, or a
  // subscription's own default) doesn't automatically make it the
  // Customer's own invoice_settings.default_payment_method — that has to
  // be set explicitly, and it's what podHq's getSavedPaymentMethod reads
  // to display/charge "the" card on file, rather than listing every
  // attached payment method and guessing which one is current.
  if (defaultPaymentMethodId) {
    try {
      await stripe.customers.update(
        customerId,
        { invoice_settings: { default_payment_method: defaultPaymentMethodId } },
        requestOptions
      );
    } catch (err) {
      console.error("[stripe-webhook] failed to set default payment method", {
        memberId,
        customerId,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

// Cross-gym PAYG top-up credit (2026-08-26): a 'purchase'-reason credit
// bought while the member currently has an active membership is minted
// as the network type instead of the base type — spendable at any gym,
// vs. their subscription's own base-type credit staying home-gym-only.
// A member with no active membership keeps the base type, unchanged —
// they already have no gym restriction at all (see podHq's
// 0064_pod_network_credit.sql for the create_booking()/cancel_booking()
// logic this backs). Only 'purchase'-reason inserts call this — a
// membership renewal (reason: 'membership') always stays the base type,
// which is exactly the credit that's meant to be home-gym-locked.
//
// Restricted to network-eligible packs only (2026-08-26, same day): a PT
// pack shares the same base credit_type as a plain gym-session pack, but
// shouldn't become cross-gym-usable just because the member happens to
// have a membership — a PT session is tied to a specific trainer at a
// specific gym. networkEligible comes from the catalog item itself
// (podHq's 0065_catalog_network_eligible.sql), passed through as Stripe
// metadata by whichever route created the charge (podhq-client's
// self-service checkout, or podHq's staff sell/saved-card panels) —
// missing/malformed metadata defaults to eligible, matching this
// feature's pre-restriction behaviour rather than silently blocking a
// legitimate purchase.
async function resolvePurchaseCreditType(memberId: number, baseCreditType: string, networkEligible: boolean): Promise<string> {
  if (!networkEligible) return baseCreditType;
  const membership = await getActiveMembership(memberId);
  return membership ? networkCreditType(baseCreditType) : baseCreditType;
}

function resolvePaymentMethodId(value: string | Stripe.PaymentMethod | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

// payment_intent-bearing fields come back as a plain id string unless the
// caller explicitly expanded them — normalizes both shapes to a plain id
// (or null) so every insert site can store one consistent value for a
// future refund lookup.
function resolvePaymentIntentId(value: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
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
