import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-encryption";
import { getStripeClient } from "@/lib/stripe";

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

export interface GymStripeContext {
  client: Stripe;
  requestOptions?: Stripe.RequestOptions;
}

// Resolves which Stripe account a gym's payments actually go through —
// checked in order: (1) a standalone gym (Carl's own, e.g. Hove — see
// podHq's 0084_gym_stripe_standalone.sql) has its own real account and
// its own key, used directly, no stripeAccount header at all; (2) a
// franchisee gym that's completed Stripe Connect onboarding gets the
// shared platform key + a stripeAccount request option; (3) no config at
// all falls back to the shared platform account exactly as every gym
// behaved before Connect existed. Every route that creates or reads a
// Stripe object for a specific gym should go through this rather than
// getGymStripeAccountId directly, which only covers the Connect case.
export async function getGymStripeContext(gym: string): Promise<GymStripeContext> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gym_stripe_config")
    .select("stripe_account_id, onboarding_complete, api_key_encrypted")
    .eq("gym", gym)
    .maybeSingle();
  if (error) throw error;

  if (data?.api_key_encrypted) {
    return { client: new Stripe(decryptSecret(data.api_key_encrypted)) };
  }
  if (data?.onboarding_complete && data.stripe_account_id) {
    return { client: getStripeClient(), requestOptions: { stripeAccount: data.stripe_account_id } };
  }
  return { client: getStripeClient() };
}
