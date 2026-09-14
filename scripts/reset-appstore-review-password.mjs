import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "appstore-review@myfitpod.app";
const NEW_PASSWORD = crypto.randomBytes(12).toString("base64url");

let user;
let page = 1;
while (!user) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("listUsers failed:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => u.email === EMAIL);
  if (user || data.users.length < 200) break;
  page++;
}

if (!user) {
  console.error(`No user found with email ${EMAIL}`);
  process.exit(1);
}

const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
  password: NEW_PASSWORD,
});
if (updateError) {
  console.error("password reset failed:", updateError.message);
  process.exit(1);
}

console.log("Reset password for review account:");
console.log("  email:   ", EMAIL);
console.log("  password:", NEW_PASSWORD);
