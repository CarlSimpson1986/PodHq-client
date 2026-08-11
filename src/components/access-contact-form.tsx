"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GENDER_OPTIONS } from "@/lib/validation/access";

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export function AccessContactForm({
  initialMobileNumber,
  initialGender,
}: {
  initialMobileNumber: string;
  initialGender: string;
}) {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState(initialMobileNumber);
  const [gender, setGender] = useState(initialGender);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/access/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, gender }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      router.push("/access/address");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="mobileNumber" className="mb-1.5 block text-sm text-card-light-muted">
          Mobile number
        </label>
        <input
          id="mobileNumber"
          type="tel"
          autoComplete="tel"
          required
          placeholder="07xxx xxx xxx"
          className={inputClass}
          value={mobileNumber}
          onChange={(e) => setMobileNumber(e.target.value)}
        />
      </div>
      <div>
        <span className="mb-1.5 block text-sm text-card-light-muted">Gender</span>
        <div className="grid grid-cols-2 gap-2">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGender(option)}
              className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                gender === option
                  ? "border-card-light-foreground bg-card-light-foreground text-white"
                  : "border-card-light-border text-card-light-foreground hover:bg-card-border/10"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading || !gender} className={buttonClass}>
        {loading ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}
