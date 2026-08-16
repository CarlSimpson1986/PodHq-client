import "server-only";
import { getGymResendConfig } from "@/lib/data/resend-config";

const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  gym: string;
}

interface SendEmailResult {
  ok: boolean;
  providerMessageId?: string;
  errorDetail?: string;
}

/**
 * Thin wrapper over Resend's HTTP API — raw fetch, no SDK dependency, same
 * precedent as podHq's brevo.ts. Deliberately a separate provider/account
 * from Brevo (Supabase Auth's own SMTP provider): Brevo's free tier
 * (300/day) already got hit once during Stage 5 signup testing and is
 * shared with Auth's confirm/reset emails — this app's own transactional
 * volume must never be able to compete with or starve those out again.
 *
 * Each gym can have its own Resend account (own quota, own sender
 * identity — podHq's /setup, admin-only, src/lib/data/resend-config.ts
 * there) so one gym's volume can never eat into another's. A gym with no
 * config falls back to the shared RESEND_API_KEY/RESEND_FROM_ADDRESS env
 * vars — unlike Brevo's lead-sync (best-effort, low-stakes), these are
 * member-facing transactional emails, so "just don't send it" is the
 * wrong default for an unconfigured gym.
 *
 * Never throws — always returns a result so the caller (notifyFireAndForget)
 * can log the real outcome instead of an unhandled rejection silently
 * skipping the log entry.
 */
export async function sendEmail({ to, subject, html, gym }: SendEmailInput): Promise<SendEmailResult> {
  const gymConfig = await getGymResendConfig(gym);

  const apiKey = gymConfig?.apiKey ?? process.env.RESEND_API_KEY;
  const from = gymConfig ? `${gymConfig.fromName} <${gymConfig.fromAddress}>` : process.env.RESEND_FROM_ADDRESS;

  if (!apiKey || !from) {
    return { ok: false, errorDetail: "No Resend config for this gym and no shared RESEND_API_KEY/RESEND_FROM_ADDRESS fallback" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      return { ok: false, errorDetail: `Resend ${res.status}: ${await res.text()}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, providerMessageId: data.id };
  } catch (err) {
    return { ok: false, errorDetail: err instanceof Error ? err.message : "Unknown error" };
  }
}
