import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Lead nurture (podHq 0106): a member who ticked marketing consent at
// signup is added to their gym's Brevo list once their email is confirmed,
// and taken off it on their first real purchase — the Brevo workflow exits
// contacts who leave the list, which stops the nurture emails. The Brevo
// keys live only in podHQ, so both calls go through its internal
// /api/brevo/lead endpoint, same pattern as the PDK unlock proxy. Every
// function here is best-effort: a Brevo or podHQ outage must never break
// sign-in or a Stripe webhook.

type BrevoLeadPayload =
  | { action: "add"; gym: string; email: string; firstName: string; lastName: string }
  | { action: "remove"; gym: string; email: string };

async function callPodhqBrevo(payload: BrevoLeadPayload): Promise<boolean> {
  const baseUrl = process.env.PODHQ_BASE_URL;
  const secret = process.env.PDK_PROXY_SECRET;
  if (!baseUrl || !secret) {
    console.error("[brevo-lead] PODHQ_BASE_URL / PDK_PROXY_SECRET not configured");
    return false;
  }
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/brevo/lead`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.error("[brevo-lead] podHQ request failed", { action: payload.action, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName: firstName ?? "", lastName: rest.join(" ") };
}

/**
 * Called after any successful email-link sign-in (complete-callback). Only
 * acts once, for a confirmed, consenting member who hasn't bought anything:
 * claims brevo_lead_synced_at in the same UPDATE that checks those
 * conditions, so two callbacks racing can't both add the contact, and
 * releases the claim if podHQ/Brevo fails so the next sign-in retries.
 */
export async function syncConsentedLeadToBrevo(authUserId: string, email: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: claimed, error } = await admin
      .from("members")
      .update({ brevo_lead_synced_at: new Date().toISOString() })
      .eq("auth_user_id", authUserId)
      .not("marketing_consent_at", "is", null)
      .is("brevo_lead_synced_at", null)
      .is("first_purchase_at", null)
      .select("id, name, gym")
      .maybeSingle();
    if (error || !claimed) return;

    const ok = await callPodhqBrevo({ action: "add", gym: claimed.gym, email, ...splitName(claimed.name) });
    if (!ok) {
      await admin.from("members").update({ brevo_lead_synced_at: null }).eq("id", claimed.id);
    }
  } catch (err) {
    console.error("[brevo-lead] sync failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Called from the Stripe webhook's fresh-insert gates on any real purchase.
 * Sets first_purchase_at once; only the call that actually sets it (and
 * only if the member was on the Brevo list) removes them from the list.
 * A failed removal isn't retried automatically — logged for follow-up.
 */
export async function markFirstPurchase(memberId: number, email: string | null | undefined): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: first, error } = await admin
      .from("members")
      .update({ first_purchase_at: new Date().toISOString() })
      .eq("id", memberId)
      .is("first_purchase_at", null)
      .select("gym, brevo_lead_synced_at")
      .maybeSingle();
    if (error || !first || !first.brevo_lead_synced_at || !email) return;

    const ok = await callPodhqBrevo({ action: "remove", gym: first.gym, email });
    if (!ok) console.error("[brevo-lead] failed to remove converted lead from Brevo", { memberId });
  } catch (err) {
    console.error("[brevo-lead] markFirstPurchase failed", { memberId, error: err instanceof Error ? err.message : String(err) });
  }
}
