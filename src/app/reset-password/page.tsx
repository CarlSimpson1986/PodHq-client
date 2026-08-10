"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";
import { PageHero } from "@/components/page-hero";
import { LockIcon } from "@/components/icons";

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

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
    <main className="flex min-h-full flex-1 flex-col">
      <PageHero title="Set a new password" subtitle="My Fit Pod — Aylesbury Berryfields" icon={LockIcon} />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          <form className="space-y-5" onSubmit={handleSubmit}>
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
      </div>
    </main>
  );
}
