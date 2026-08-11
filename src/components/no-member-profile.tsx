import Link from "next/link";

// Shown when a signed-in Supabase Auth session has no matching `members`
// row — most commonly an email that already exists elsewhere in this
// shared project (e.g. a podHq staff login) and was never linked to a pod
// member profile. Signup silently no-ops for that case (Supabase sends no
// confirmation email for an already-registered address), so pointing here
// at "sign up again" would just repeat the same silent dead end — the real
// fix for that case is an admin linking the existing account directly.
export function NoMemberProfile() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6 text-center">
      <p className="text-base font-semibold text-foreground">We couldn&apos;t find a member profile for this account.</p>
      <p className="text-sm text-muted-foreground">
        If you&apos;re new here, sign up with a different email to create one.
      </p>
      <p className="text-sm text-muted-foreground">
        If you already expect this email to have member access — for example it&apos;s also used for staff login
        elsewhere — contact us and we&apos;ll link it for you.
      </p>
      <Link
        href="/signup"
        className="mt-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
      >
        Sign up
      </Link>
    </main>
  );
}
