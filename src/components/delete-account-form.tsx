"use client";

import { useState } from "react";

export function DeleteAccountForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"ok" | "error" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/account/delete-request?email=${encodeURIComponent(email)}`);
      const body = await res.json();
      setResult(body.status === "ok" ? "ok" : "error");
    } catch {
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result === "ok") {
    return (
      <p className="mt-4 text-sm font-semibold text-card-light-foreground">
        Request received — we&apos;ll be in touch to confirm once it&apos;s actioned.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-card-light-border bg-card-light px-3 py-2 text-sm text-card-light-foreground"
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg border border-card-light-border px-3 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white disabled:opacity-50"
      >
        {submitting ? "Sending..." : "Request account deletion"}
      </button>
      {result === "error" && (
        <p className="text-xs text-danger">Something went wrong — try again, or email us directly.</p>
      )}
    </form>
  );
}
