"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";

const buttonClass =
  "w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json();
      if (body.status === "ok") {
        router.push("/book");
        router.refresh();
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
        <h1 className="mb-1 text-lg font-semibold">Set a new password</h1>
        <p className="mb-6 text-sm text-muted-foreground">My Fit Pod — book your session.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <PasswordInput
            id="password"
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            hint="At least 8 characters, with an uppercase letter, lowercase letter, and a number."
          />
          <PasswordInput
            id="confirmPassword"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Saving..." : "Save password"}
          </button>
        </form>
      </div>
    </main>
  );
}
