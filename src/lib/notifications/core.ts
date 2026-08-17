import "server-only";
import { sendEmail } from "./resend";
import { logNotification } from "./log";
import type { NotificationEventType } from "./types";

/** Shared by every notification that links back into the app — moved here from waitlist/offer-next.ts once a second and third call site needed it. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NODE_ENV !== "development") {
    throw new Error("APP_URL is not set — required outside local development so notification emails don't link to localhost.");
  }
  return "http://localhost:3000";
}

interface NotifyInput {
  eventType: NotificationEventType;
  to: string;
  subject: string;
  html: string;
  gym: string;
  memberId?: number;
}

/**
 * The one place "send an email" and "log the outcome" happen together.
 * Deliberately swallows every failure (network, Resend 4xx/5xx, missing
 * config) rather than throwing — a booking/purchase/signup must succeed
 * even if its email never sends. This is the direct structural fix for the
 * historical Kisi-unlock bug (unlock/route.ts's original unwrapped call let
 * a failed unlock skip its own audit-log row entirely): every path through
 * here, success or failure, always reaches logNotification.
 *
 * Callers `await` this before returning their response rather than firing
 * it unawaited — a bare unawaited promise after `return NextResponse.json`
 * isn't guaranteed to finish once Vercel's serverless runtime sends the
 * response. Awaiting only gates the response on completion, never on
 * success: this function itself never throws, so it can never turn into an
 * error response for the caller.
 */
export async function notifyFireAndForget(input: NotifyInput): Promise<void> {
  const result = await sendEmail({ to: input.to, subject: input.subject, html: input.html, gym: input.gym });

  await logNotification({
    eventType: input.eventType,
    recipientEmail: input.to,
    memberId: input.memberId,
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
    errorDetail: result.errorDetail,
  });
}
