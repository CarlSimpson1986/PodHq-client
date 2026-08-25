"use client";

import { useState } from "react";
import Link from "next/link";

// Shown when a signed-in Supabase Auth session has no matching `members`
// row — most commonly an email that already exists elsewhere in this
// shared project (e.g. a podHq staff login), or a stale/leftover session
// (a different account's cookie still valid in this browser — the same
// class of dead end ROADMAP.md's archive documents from 2026-08-10).
// Signup silently no-ops for the already-registered-email case (Supabase
// sends no confirmation email for that), so pointing here at "sign up
// again" would just repeat the same silent dead end — the real fix for
// that case is an admin linking the existing account directly.
//
// Previously had NO way out of this screen except "Sign up" — a member
// stuck behind the wrong account's session had no way to log out and try
// again, so this same complaint kept recurring (Carl, 2026-08-25). Log
// out is the same fetch + service-worker-cache-clear + redirect sequence
// profile-view.tsx's own logout button uses.
export function NoMemberProfile() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("podhq-client-")).map((key) => caches.delete(key)));
      }
      // window.location, not router.push — see profile-view.tsx's logout
      // for why (clears Next's in-memory Client Cache, staleTimes.dynamic).
      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6 text-center">
      <p className="text-base font-semibold text-foreground">We couldn&apos;t find a member profile for this account.</p>
      <p className="text-sm text-muted-foreground">
        If you&apos;re signed in as the wrong account, log out below and sign in again.
      </p>
      <p className="text-sm text-muted-foreground">
        If you&apos;re new here, sign up with a different email to create one.
      </p>
      <p className="text-sm text-muted-foreground">
        If you already expect this email to have member access — for example it&apos;s also used for staff login
        elsewhere — contact us and we&apos;ll link it for you.
      </p>
      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className="mt-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
      >
        {loggingOut ? "Logging out..." : "Log out and try again"}
      </button>
      <Link href="/signup" className="text-sm font-semibold text-accent underline">
        Or sign up with a different email
      </Link>
    </main>
  );
}
