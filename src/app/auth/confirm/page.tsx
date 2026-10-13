"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// Landing page for the signup confirmation email's link. Confirms on load
// (JS-only, so a mail scanner fetching the URL doesn't use up the token),
// then goes straight to the sign-in page.
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
  const [state, setState] = useState<"working" | "error">("working");

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
        if (body.status === "ok") {
          window.location.href = "/login?confirmed=1";
          return;
        }
        setState("error");
      } catch {
        setState("error");
      }
    }

    run();
  }, [searchParams]);

  if (state === "error") {
    return (
      <ConfirmCard title="Link already used" error>
        This link has already been used or has expired. If you&apos;ve already confirmed your email, just{" "}
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
