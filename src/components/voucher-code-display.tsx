"use client";

import { useState } from "react";
import Link from "next/link";

export function VoucherCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the code is still
      // shown on screen either way, so this isn't fatal to the flow.
    }
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-success">Payment received — your voucher is ready.</p>
      <div className="rounded-xl border-2 border-dashed border-card-light-foreground p-6">
        <p className="text-3xl font-bold tracking-widest tabular-nums">{code}</p>
      </div>
      <button
        onClick={copy}
        className="rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
      >
        {copied ? "Copied!" : "Copy code"}
      </button>
      <p className="text-sm text-card-light-muted">
        Save this code — it can be redeemed by anyone for credits on{" "}
        <Link href="/buy-credits" className="underline">
          the Buy Credits page
        </Link>
        .
      </p>
      <Link href="/shop" className="block text-sm text-card-light-muted underline">
        Back to shop
      </Link>
    </div>
  );
}
