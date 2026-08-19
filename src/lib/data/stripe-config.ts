import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Cross-app read, same pattern as src/lib/data/resend-config.ts —
// podHq owns the admin UI that writes gym_stripe_config (see its /setup
// page), this app only ever reads it. A gym with no completed connection
// returns null and callers fall back to the shared platform account
// (STRIPE_SECRET_KEY) exactly as every gym behaved before Stripe Connect
// existed — not a breaking change for anyone but a gym that's actually
// been through onboarding. gym is a plain string, not GymName, matching
// every other per-gym data-layer lookup here (e.g. getCreditPackageById).
export async function getGymStripeAccountId(gym: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gym_stripe_config")
    .select("stripe_account_id, onboarding_complete")
    .eq("gym", gym)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.onboarding_complete) return null;
  return data.stripe_account_id;
}
