"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// Landing page for the signup confirmation email's link. Confirms on load
// (JS-only, so a mail scanner fetching the URL doesn't use up the token)
// and tells the member to go back to the app, where the signup screen's
// continue button signs them in.
export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<ConfirmCard title="Confirming your email...">One moment...</ConfirmCard>}>
      <ConfirmEmailInner />
    </Suspense>
  );
}

function ConfirmEmailInner() {
  const searchParams = useSearchParams();
  const ran = useRef(false);
  const [state, setState] = useState<"working" | "ok" | "error">("working");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const tokenHash = searchParams.get("token_hash");
      if (!tokenHash) {
        setState("error");
        return;
      }
      try {
        const res = await fetch("/api/auth/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenHash }),
        });
        const body = await res.json();
        setState(body.status === "ok" ? "ok" : "error");
      } catch {
        setState("error");
      }
    }

    run();
  }, [searchParams]);

  if (state === "ok") {
    return (
      <ConfirmCard title="Email confirmed">
        You&apos;re all set. Go back to the My Fit Pod app and tap continue.{" "}
        {/* Full reload, not <Link> — picks up the session just set here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="text-accent hover:underline">
          Or continue here
        </a>
      </ConfirmCard>
    );
  }
  if (state === "error") {
    return (
      <ConfirmCard title="Link already used" error>
        This link has already been used or has expired. If you&apos;ve already confirmed, go back to the My Fit Pod
        app and tap continue, or{" "}
        <a href="/login" className="text-accent hover:underline">
          sign in
        </a>
        .
      </ConfirmCard>
    );
  }
  return <ConfirmCard title="Confirming your email...">One moment...</ConfirmCard>;
}

function ConfirmCard({ title, error, children }: { title: string; error?: boolean; children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="card-light w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold">{title}</h1>
        <p className={`text-sm ${error ? "text-danger" : "text-card-light-muted"}`}>{children}</p>
      </div>
    </main>
  );
}
