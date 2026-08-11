"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RedeemVoucherForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function redeem() {
    if (pending || !code.trim()) return;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Could not redeem that code.");
        return;
      }
      setSuccess(`Redeemed — ${body.credits} credits added.`);
      setCode("");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-card-light-border p-4">
      <p className="text-sm font-semibold">Have a gift voucher?</p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-card-light-border px-3 py-2 text-sm uppercase"
        />
        <button
          onClick={redeem}
          disabled={pending || !code.trim()}
          className="shrink-0 rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Redeeming..." : "Redeem"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {success && <p className="mt-2 text-sm text-success">{success}</p>}
    </div>
  );
}
