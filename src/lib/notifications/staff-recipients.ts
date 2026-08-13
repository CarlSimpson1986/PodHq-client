import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const AUTH_LIST_PAGE_SIZE = 200;

/**
 * Every staff email address that should hear about an event at `gym`: that
 * gym's owner(s) (role='owner', gym matches) plus every admin (role='admin',
 * gym is null, oversees everything) — mirrors podHq's getAllUsers() role
 * distinction (podHq/src/lib/data/admin.ts) without duplicating that table.
 * Reads users_gyms directly via this app's own admin client — safe because
 * it's the same Postgres database as podHq and the service-role key
 * bypasses RLS entirely, no cross-app restriction.
 *
 * Two separate queries rather than one .or() filter string interpolating
 * `gym` — avoids relying on exactly how Supabase's PostgREST client escapes
 * a raw value inside an .or() expression, which isn't worth the risk for
 * something this cheap to just do as two queries.
 */
export async function getStaffRecipients(gym: string): Promise<string[]> {
  const admin = createAdminClient();

  const [adminRows, ownerRows] = await Promise.all([
    admin.from("users_gyms").select("user_id").eq("role", "admin"),
    admin.from("users_gyms").select("user_id").eq("role", "owner").eq("gym", gym),
  ]);

  if (adminRows.error || ownerRows.error) {
    console.error("[notifications] failed to resolve staff recipients", {
      gym,
      error: adminRows.error?.message ?? ownerRows.error?.message,
    });
    return [];
  }

  const userIds = new Set<string>([
    ...adminRows.data.map((r) => r.user_id as string),
    ...ownerRows.data.map((r) => r.user_id as string),
  ]);
  if (userIds.size === 0) return [];

  const emails: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_LIST_PAGE_SIZE });
    if (error) {
      console.error("[notifications] failed to list auth users for staff recipients", { error: error.message });
      break;
    }

    for (const u of data.users) {
      if (userIds.has(u.id) && u.email) emails.push(u.email);
    }

    if (data.users.length < AUTH_LIST_PAGE_SIZE) break;
    page += 1;
  }

  return emails;
}
