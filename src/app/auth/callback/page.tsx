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
      // Our own app-level routing intent, kept in a param Supabase never
      // sets itself — "type" isn't safe for this: Supabase always stamps
      // its own value into the hash (e.g. "magiclink" for every magic-link
      // callback, ours or not), which shadows a same-named query param via
      // the `??` above before our check ever runs.
      const mode = searchParams.get("mode");
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
          return;
        }

        if (mode === "link_existing") {
          // The magic link itself already proved ownership of this inbox —
          // this just creates the member row now that a session exists.
          const linkRes = await fetch("/api/auth/link-existing-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: searchParams.get("name") ?? "", gym: searchParams.get("gym") ?? "" }),
          });
          const linkBody = await linkRes.json();
          if (linkBody.status !== "ok") {
            setError(true);
            return;
          }
        }

        router.push("/book");
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
