import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMemberContact } from "@/lib/notifications/resolve-member-contact";
import { notifyFireAndForget, appUrl } from "@/lib/notifications/core";
import { waitlistOfferedEmail } from "@/lib/notifications/templates";
import { sendPush } from "@/lib/push/send";

const OFFER_WINDOW_MS = 15 * 60 * 1000;
// Guard against pointless offers: if a cancellation happens with less
// notice than this before slot_start, nobody could realistically accept
// and still make it — the slot just opens up normally instead of issuing
// an offer nobody can act on in time.
const MIN_NOTICE_MS = 20 * 60 * 1000;

/**
 * Finds the next waiting person for a resource+slot and offers them the
 * spot — called after a cancellation frees capacity, after a decline, or
 * after an offer is found to have expired. Correctness of *who currently
 * holds the slot* doesn't depend on this function running promptly
 * (create_booking's own timestamp check handles that, see
 * 0024_waitlist.sql / 0039_pod_resources_functions.sql) — this only
 * controls how quickly the *next* person gets notified, which matters for
 * UX but never for correctness.
 *
 * Takes resourceId, not gym — a gym can have more than one bookable
 * resource (see pod_resources, 0038_pod_resources.sql), and resourceId
 * alone already fully identifies the slot; gym is derived internally
 * (for the notification copy) rather than trusted as a separate,
 * possibly-mismatched parameter, same "derive rather than trust" pattern
 * create_booking() itself now uses.
 *
 * Never throws — a cancellation/decline/expiry-check must succeed even if
 * offering the next person fails for some reason (DB hiccup, missing
 * contact info); the failure is logged, not propagated.
 */
export async function offerNextWaitlistEntry(resourceId: number, slotStartIso: string): Promise<void> {
  const slotStart = new Date(slotStartIso);
  if (slotStart.getTime() - Date.now() < MIN_NOTICE_MS) return;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    // Expire any stale offer for this slot first, so a fresh one can go out.
    await admin
      .from("waitlist_entries")
      .update({ status: "expired" })
      .eq("resource_id", resourceId)
      .eq("slot_start", slotStartIso)
      .eq("status", "offered")
      .lt("offer_expires_at", nowIso);

    // Don't issue a second concurrent offer if one's already active.
    const { data: activeOffer } = await admin
      .from("waitlist_entries")
      .select("id")
      .eq("resource_id", resourceId)
      .eq("slot_start", slotStartIso)
      .eq("status", "offered")
      .gt("offer_expires_at", nowIso)
      .maybeSingle();
    if (activeOffer) return;

    const { data: nextEntry } = await admin
      .from("waitlist_entries")
      .select("id, member_id, gym")
      .eq("resource_id", resourceId)
      .eq("slot_start", slotStartIso)
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!nextEntry) return;

    const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_MS).toISOString();
    // Guards against a race with itself (e.g. two triggers firing near-
    // simultaneously) — only the first update actually matches status='waiting'.
    const { data: updated, error: updateError } = await admin
      .from("waitlist_entries")
      .update({ status: "offered", offered_at: nowIso, offer_expires_at: offerExpiresAt })
      .eq("id", nextEntry.id)
      .eq("status", "waiting")
      .select("id");

    if (updateError || !updated || updated.length === 0) {
      if (updateError) console.error("[waitlist] failed to mark entry offered", { entryId: nextEntry.id, error: updateError.message });
      return;
    }

    const contact = await resolveMemberContact(nextEntry.member_id);
    if (!contact) return;

    const gym = nextEntry.gym as string;
    const acceptUrl = `${appUrl()}/waitlist/${nextEntry.id}`;
    const { subject, html } = waitlistOfferedEmail({
      memberName: contact.name,
      gym,
      slotStart: slotStartIso,
      acceptUrl,
    });
    await notifyFireAndForget({
      eventType: "waitlist_offered",
      to: contact.email,
      subject,
      html,
      memberId: nextEntry.member_id,
      gym,
    });

    await sendPush({
      memberId: nextEntry.member_id,
      title: "A spot opened up!",
      body: `Your waitlisted session at ${gym} is available for 15 minutes.`,
      url: `/waitlist/${nextEntry.id}`,
    });
  } catch (err) {
    console.error("[waitlist] offerNextWaitlistEntry failed", { resourceId, slotStartIso, error: err instanceof Error ? err.message : err });
  }
}
