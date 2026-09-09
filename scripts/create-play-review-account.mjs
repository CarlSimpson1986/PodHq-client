import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "playstore-review@myfitpod.app";
const PASSWORD = crypto.randomBytes(12).toString("base64url");
const GYM = "Hove";

const { data: userData, error: userError } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (userError) {
  console.error("createUser failed:", userError.message);
  process.exit(1);
}

const now = new Date().toISOString();
const { data: memberRows, error: memberError } = await admin
  .from("members")
  .insert({
    auth_user_id: userData.user.id,
    gym: GYM,
    name: "Google Play Reviewer",
    waiver_signed_name: "Google Play Reviewer",
    waiver_signed_at: now,
    privacy_policy_accepted_at: now,
    tour_completed_at: now,
    trial_activated_at: now,
    trial_started_at: now,
    trial_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
  })
  .select("id")
  .single();
if (memberError) {
  console.error("member insert failed:", memberError.message);
  process.exit(1);
}

const { error: creditError } = await admin
  .from("credits")
  .insert({ member_id: memberRows.id, amount: 5, reason: "manual_grant" });
if (creditError) {
  console.error("credit grant failed:", creditError.message);
  process.exit(1);
}

console.log("Created review account:");
console.log("  email:   ", EMAIL);
console.log("  password:", PASSWORD);
console.log("  gym:     ", GYM);
console.log("  member id:", memberRows.id);
console.log("  credits granted: 5");
