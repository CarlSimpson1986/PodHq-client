"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { PageHero } from "@/components/page-hero";
import { UserPlusIcon } from "@/components/icons";
import { GYM_NAMES, type GymName } from "@/lib/gym";

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

function isGymName(value: string): value is GymName {
  return (GYM_NAMES as readonly string[]).includes(value);
}

// useSearchParams needs a Suspense boundary (Next's own requirement), so
// the actual form lives here and the default export below just wraps it.
function SignupForm() {
  const searchParams = useSearchParams();
  const gymParam = searchParams.get("gym");
  // A gym-specific signup link (e.g. from a QR code or that gym's own ad
  // campaign) pre-selects the field so the member doesn't have to know
  // their gym's exact name among all 10 — still fully editable, just a
  // sensible default rather than a lock.
  const initialGym = gymParam && isGymName(gymParam) ? gymParam : "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gym, setGym] = useState<GymName | "">(initialGym);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!gym) {
      setError("Please select your gym.");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, gym }),
      });
      const body = await res.json();
      if (body.status === "ok") {
        setMessage(
          body.message ?? "Check your email — we've sent a confirmation link, or a sign-in link if you already have an account."
        );
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
      <PageHero title="Create an account" subtitle="My Fit Pod" icon={UserPlusIcon} />
      <div className="card-light flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md">
          {message ? (
            <p className="text-sm text-success">{message}</p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm text-card-light-muted">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="gym" className="mb-1.5 block text-sm text-card-light-muted">
                  Your gym
                </label>
                <select
                  id="gym"
                  required
                  className={inputClass}
                  value={gym}
                  onChange={(e) => setGym(e.target.value as GymName)}
                >
                  <option value="" disabled>
                    Select your gym
                  </option>
                  {GYM_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
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
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                hint="At least 8 characters, with an uppercase letter, lowercase letter, and a number."
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}
          <p className="mt-6 text-sm text-card-light-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-card-light-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
