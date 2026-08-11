"use client";

import { useState } from "react";
import Link from "next/link";
import { VOUCHER_PRESETS_GBP, VOUCHER_MIN_GBP, VOUCHER_MAX_GBP, creditsForVoucherAmount } from "@/lib/gift-voucher";

export function BuyVoucherForm() {
  const [amount, setAmount] = useState<number | null>(VOUCHER_PRESETS_GBP[0]);
  const [customAmount, setCustomAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAmount = customAmount ? Number(customAmount) : amount;
  const credits = selectedAmount ? creditsForVoucherAmount(selectedAmount) : 0;

  async function buy() {
    if (pending || !selectedAmount) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/checkout-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountGBP: selectedAmount }),
      });
      const body = await res.json();
      if (body.status !== "ok" || !body.url) {
        setError(body.message ?? "Could not start checkout.");
        setPending(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Something went wrong. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-card-light-muted">Set the voucher amount</p>
        <p className="mt-1 text-sm text-card-light-muted">
          The code will be shown immediately after payment — save it or pass it on.
        </p>
      </div>

      <input
        type="number"
        min={VOUCHER_MIN_GBP}
        max={VOUCHER_MAX_GBP}
        placeholder={`Enter amount (£${VOUCHER_MIN_GBP}–£${VOUCHER_MAX_GBP})`}
        value={customAmount}
        onChange={(e) => {
          setCustomAmount(e.target.value);
          setAmount(null);
        }}
        className="w-full rounded-lg border border-card-light-border px-4 py-3 text-base"
      />

      <div className="flex flex-wrap gap-2">
        {VOUCHER_PRESETS_GBP.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setAmount(preset);
              setCustomAmount("");
            }}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              amount === preset && !customAmount
                ? "border-card-light-foreground bg-card-light-foreground text-white"
                : "border-card-light-border text-card-light-foreground"
            }`}
          >
            £{preset}
          </button>
        ))}
      </div>

      {selectedAmount ? (
        <p className="text-sm text-card-light-muted">Redeemable for {credits} credits.</p>
      ) : null}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        onClick={buy}
        disabled={pending || !selectedAmount || selectedAmount < VOUCHER_MIN_GBP || selectedAmount > VOUCHER_MAX_GBP}
        className="w-full rounded-lg bg-card-light-foreground px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Redirecting..." : "Go to Checkout"}
      </button>

      <Link href="/shop" className="block text-center text-sm text-card-light-muted hover:text-card-light-foreground">
        Back to shop
      </Link>
    </div>
  );
}
