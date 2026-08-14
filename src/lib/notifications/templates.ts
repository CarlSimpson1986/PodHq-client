function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function formatSlot(iso: string): string {
  if (!iso) return "your session";
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} at ${time}`;
}

/** Shared header/footer — plain inline styles only, email clients can't use the app's Tailwind tokens. */
function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <div style="background: #000; color: #fff; padding: 24px; text-align: center;">
        <strong style="font-size: 18px;">My Fit Pod</strong>
      </div>
      <div style="padding: 24px; line-height: 1.5;">
        ${bodyHtml}
      </div>
      <div style="padding: 16px 24px; color: #888; font-size: 12px;">
        My Fit Pod &mdash; this is an automated message, please don't reply directly to this email.
      </div>
    </div>
  `;
}

interface EmailContent {
  subject: string;
  html: string;
}

export function bookingConfirmedEmail(input: {
  memberName: string;
  gym: string;
  slotStart: string;
  isFirstBooking: boolean;
  accessComplete: boolean;
}): EmailContent {
  const firstBookingGuide = input.isFirstBooking
    ? `
      <p style="margin-top: 16px;"><strong>This is your first session, so here's how it works:</strong></p>
      <ul style="padding-left: 20px; margin: 8px 0;">
        ${
          input.accessComplete
            ? ""
            : `<li style="margin-bottom: 8px;">Before you arrive, complete your Access details (mobile number, address, waiver) &mdash; go to <strong>Profile &rarr; Access</strong> in the app. The door won't unlock until this is done.</li>`
        }
        <li style="margin-bottom: 8px;">Make sure Location Services are turned on for the app &mdash; the door only unlocks when you're actually at the gym.</li>
        <li style="margin-bottom: 8px;">When you arrive, go to <strong>Bookings</strong> and tap <strong>Unlock</strong> to open the door.</li>
      </ul>
    `
    : "";
  return {
    subject: "Booking confirmed",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>Your pod session at <strong>${input.gym}</strong> is confirmed for <strong>${formatSlot(input.slotStart)}</strong>.</p>
      ${firstBookingGuide}
      <p>See you there!</p>
    `),
  };
}

export function bookingCancelledEmail(input: {
  memberName: string;
  gym: string;
  slotStart: string;
  refunded: boolean;
}): EmailContent {
  const refundLine = input.refunded
    ? "Your credit has been refunded."
    : "This was within 2 hours of your session, so the credit was not refunded.";
  return {
    subject: "Booking cancelled",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>Your session at <strong>${input.gym}</strong> on <strong>${formatSlot(input.slotStart)}</strong> has been cancelled.</p>
      <p>${refundLine}</p>
    `),
  };
}

export function creditPackPurchasedEmail(input: { memberName: string; credits: number }): EmailContent {
  return {
    subject: "Credit pack purchased",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>Thanks for your purchase &mdash; <strong>${input.credits} credit${input.credits === 1 ? "" : "s"}</strong> have been added to your account.</p>
    `),
  };
}

export function giftVoucherPurchasedEmail(input: {
  memberName: string;
  code: string;
  amountGBP: number;
  credits: number;
}): EmailContent {
  return {
    subject: "Gift voucher purchased",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>Your ${formatGBP(input.amountGBP)} gift voucher is ready &mdash; worth <strong>${input.credits} credit${input.credits === 1 ? "" : "s"}</strong>.</p>
      <p>Code: <strong>${input.code}</strong></p>
    `),
  };
}

export function membershipStartedEmail(input: {
  memberName: string;
  tierName: string;
  creditsPerPeriod: number;
}): EmailContent {
  return {
    subject: "Membership started",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>Your <strong>${input.tierName}</strong> membership is active &mdash; ${input.creditsPerPeriod} credit${input.creditsPerPeriod === 1 ? "" : "s"} have been added.</p>
    `),
  };
}

export function membershipRenewedEmail(input: {
  memberName: string;
  tierName: string;
  creditsPerPeriod: number;
}): EmailContent {
  return {
    subject: "Membership renewed",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>Your <strong>${input.tierName}</strong> membership has renewed &mdash; ${input.creditsPerPeriod} credit${input.creditsPerPeriod === 1 ? "" : "s"} have been added.</p>
    `),
  };
}

export function staffNewSignupEmail(input: { memberName: string; gym: string }): EmailContent {
  return {
    subject: `New signup: ${input.memberName}`,
    html: emailShell(`
      <p><strong>${input.memberName}</strong> just signed up at <strong>${input.gym}</strong>.</p>
    `),
  };
}

export function staffMembershipCancelledEmail(input: {
  memberName: string;
  gym: string;
  tierName: string;
}): EmailContent {
  return {
    subject: `Membership cancelled: ${input.memberName}`,
    html: emailShell(`
      <p><strong>${input.memberName}</strong> at <strong>${input.gym}</strong> cancelled their <strong>${input.tierName}</strong> membership.</p>
    `),
  };
}

export function staffGiftVoucherPurchasedEmail(input: {
  purchaserName: string;
  gym: string;
  amountGBP: number;
}): EmailContent {
  return {
    subject: `Gift voucher purchased: ${formatGBP(input.amountGBP)}`,
    html: emailShell(`
      <p><strong>${input.purchaserName}</strong> at <strong>${input.gym}</strong> purchased a ${formatGBP(input.amountGBP)} gift voucher.</p>
    `),
  };
}

export function waitlistOfferedEmail(input: {
  memberName: string;
  gym: string;
  slotStart: string;
  acceptUrl: string;
}): EmailContent {
  return {
    subject: "A spot just opened up!",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>A spot for <strong>${formatSlot(input.slotStart)}</strong> at <strong>${input.gym}</strong> just opened up, and you're next on the waitlist.</p>
      <p><strong>You have 15 minutes to claim it</strong> before it's offered to the next person.</p>
      <p><a href="${input.acceptUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">Claim this spot</a></p>
    `),
  };
}

export function creditsLowEmail(input: { memberName: string; creditsRemaining: number; buyCreditsUrl: string }): EmailContent {
  return {
    subject: input.creditsRemaining === 1 ? "You're down to your last credit" : `Only ${input.creditsRemaining} credits left`,
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>You've got <strong>${input.creditsRemaining} credit${input.creditsRemaining === 1 ? "" : "s"}</strong> left on your account.</p>
      <p>Top up now so you don't miss your next session.</p>
      <p><a href="${input.buyCreditsUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">Buy more credits</a></p>
    `),
  };
}

export function winBackEmail(input: { memberName: string; gym: string; daysSinceLastVisit: number; bookUrl: string }): EmailContent {
  return {
    subject: "We haven't seen you in a while",
    html: emailShell(`
      <p>Hi ${input.memberName},</p>
      <p>It's been ${input.daysSinceLastVisit} days since your last session at <strong>${input.gym}</strong> &mdash; your pod's still waiting for you.</p>
      <p><a href="${input.bookUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">Book your next session</a></p>
    `),
  };
}
