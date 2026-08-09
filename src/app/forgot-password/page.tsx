"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none";
const buttonClass =
  "w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50";

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
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="card-glass w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold">Reset your password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        {message ? (
          <p className="text-sm text-success">{message}</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-1 block text-xs text-muted-foreground">
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
        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
