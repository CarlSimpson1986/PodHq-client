"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackCard>One moment...</CallbackCard>}>
      <AuthCallbackInner />
    </Suspense>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const hashError = hashParams.get("error");
      const type = hashParams.get("type") ?? searchParams.get("type");
      const code = searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (hashError || (!code && !(accessToken && refreshToken))) {
        setError(true);
        return;
      }

      try {
        const res = await fetch("/api/auth/complete-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accessToken && refreshToken ? { accessToken, refreshToken } : { code }),
        });
        const body = await res.json();

        if (body.status !== "ok") {
          setError(true);
          return;
        }

        if (type === "recovery") {
          router.push("/reset-password");
        } else {
          router.push("/book");
        }
      } catch {
        setError(true);
      }
    }

    run();
  }, [router, searchParams]);

  return (
    <CallbackCard error={error}>
      {error ? (
        <>
          This link is invalid or has expired.{" "}
          <a href="/login" className="text-accent hover:underline">
            Back to sign in
          </a>
        </>
      ) : (
        "One moment..."
      )}
    </CallbackCard>
  );
}

function CallbackCard({ error, children }: { error?: boolean; children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="card-glass w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold">{error ? "Link expired" : "Signing you in..."}</h1>
        <p className={`text-sm ${error ? "text-danger" : "text-muted-foreground"}`}>{children}</p>
      </div>
    </main>
  );
}
