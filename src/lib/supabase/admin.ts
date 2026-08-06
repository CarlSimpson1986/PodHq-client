import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — only ever use this after the
 * caller's session has already been verified. Never import from a Client
 * Component. Same pattern as podHq's admin.ts — see that repo's "Auth
 * pattern in server-side code" note for why RLS is never the actual
 * authorization check here.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server environment variables are not configured");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
