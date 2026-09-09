import { DeleteAccountForm } from "@/components/delete-account-form";
import { PageHero } from "@/components/page-hero";

// Public (see proxy.ts's PUBLIC_PATHS) — Google Play requires this to work
// even for someone who's uninstalled the app or can't sign in.
export default function DeleteAccountPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col pb-10">
      <PageHero title="Delete account" subtitle="My Fit Pod" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          <p className="text-sm leading-relaxed text-card-light-muted">
            Enter the email address on your My Fit Pod account below to request that your account and associated data
            be deleted. We&apos;ll action this manually and confirm by email — this isn&apos;t instant, since we
            check things like an active membership or booking history first.
          </p>
          <DeleteAccountForm />
        </div>
      </div>
    </main>
  );
}
