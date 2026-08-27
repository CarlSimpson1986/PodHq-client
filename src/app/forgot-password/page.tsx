"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { LockIcon } from "@/components/icons";

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (body.status === "ok") {
        setMessage(body.message ?? "If an account exists for that email, a reset link has been sent.");
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
      <PageHero title="Reset your password" subtitle="Enter your email and we'll send you a reset link." icon={LockIcon} />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          {message ? (
            <p className="text-sm text-success">{message}</p>
          ) : (
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
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}
          <p className="mt-6 text-sm text-card-light-muted">
            <Link href="/login" className="text-card-light-foreground hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
