"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

export function AccessAddressForm({
  initialLine1,
  initialLine2,
  initialCity,
  initialPostcode,
}: {
  initialLine1: string;
  initialLine2: string;
  initialCity: string;
  initialPostcode: string;
}) {
  const router = useRouter();
  const [addressLine1, setAddressLine1] = useState(initialLine1);
  const [addressLine2, setAddressLine2] = useState(initialLine2);
  const [addressCity, setAddressCity] = useState(initialCity);
  const [addressPostcode, setAddressPostcode] = useState(initialPostcode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/access/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressLine1, addressLine2, addressCity, addressPostcode }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      router.push("/access/waiver");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="addressLine1" className="mb-1.5 block text-sm text-card-light-muted">
          Address line 1
        </label>
        <input
          id="addressLine1"
          type="text"
          autoComplete="address-line1"
          required
          className={inputClass}
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="addressLine2" className="mb-1.5 block text-sm text-card-light-muted">
          Address line 2 (optional)
        </label>
        <input
          id="addressLine2"
          type="text"
          autoComplete="address-line2"
          className={inputClass}
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="addressCity" className="mb-1.5 block text-sm text-card-light-muted">
          Town / city
        </label>
        <input
          id="addressCity"
          type="text"
          autoComplete="address-level2"
          required
          className={inputClass}
          value={addressCity}
          onChange={(e) => setAddressCity(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="addressPostcode" className="mb-1.5 block text-sm text-card-light-muted">
          Postcode
        </label>
        <input
          id="addressPostcode"
          type="text"
          autoComplete="postal-code"
          required
          className={inputClass}
          value={addressPostcode}
          onChange={(e) => setAddressPostcode(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Saving..." : "Continue"}
      </button>
    </form>
  );
}
