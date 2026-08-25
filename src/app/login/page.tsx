"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { PageHero } from "@/components/page-hero";
import { LockIcon } from "@/components/icons";

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (body.status === "ok") {
        // window.location, not router.push — a full reload clears Next's
        // in-memory Client Cache (staleTimes.dynamic, see next.config.ts)
        // so a previous member's cached pages on this device can never
        // bleed into this new session. router.refresh() alone only
        // clears the cache for the route it's called on, not every
        // previously-cached route.
        window.location.href = "/book";
      } else {
        setError(body.message ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Sign in" subtitle="My Fit Pod" icon={LockIcon} />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm text-card-light-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <PasswordInput
              id="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div className="mt-6 flex justify-between text-sm text-card-light-foreground">
            <Link href="/signup" className="hover:underline">
              Create an account
            </Link>
            <Link href="/forgot-password" className="hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
