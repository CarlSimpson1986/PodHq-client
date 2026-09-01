"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PRIVACY_POLICY } from "@/lib/privacy-policy";
import type { WaiverBlock } from "@/lib/waiver-terms";

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

// Same block-rendering shape as access-waiver-form.tsx's TermsBlock —
// kept as a local copy rather than a shared import since the two forms'
// styling is coincidentally identical today but each is free to diverge
// (e.g. this one never needs a signed-name input).
function PolicyBlock({ block }: { block: WaiverBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-lg font-semibold text-card-light-foreground">{block.text}</h2>;
    case "subheading":
      return <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-card-light-foreground">{block.text}</h3>;
    case "paragraph":
      return <p className="mt-2 text-sm leading-relaxed text-card-light-muted">{block.text}</p>;
    case "list":
      return (
        <ul className="mt-2 space-y-2">
          {block.items.map((item) => (
            <li key={item.title} className="text-sm leading-relaxed text-card-light-muted">
              <span className="font-semibold text-card-light-foreground">{item.title}</span>
              {item.body ? <span> — {item.body}</span> : null}
            </li>
          ))}
        </ul>
      );
  }
}

// Gates first use of Pod Coach (chat, and connecting a wearable) — see
// privacy-policy.ts Section 8 / migration 0080. Renders inline wherever
// it's mounted (the Coach page swaps this in for the chat when
// !hasAcceptedPrivacyPolicy(member)), not a redirect to a separate page,
// so accepting drops the member straight into the chat they came for.
export function PrivacyConsentForm() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/privacy/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-card-light-muted">Before using Pod Coach, please read and accept our Privacy Policy.</p>
      <div className="max-h-96 overflow-y-auto rounded-xl border border-card-light-border p-4">
        {PRIVACY_POLICY.map((block, i) => (
          <PolicyBlock key={i} block={block} />
        ))}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="flex items-start gap-3 text-sm text-card-light-muted">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-card-light-border"
          />
          I have read and agree to the Privacy Policy above, including Pod Coach&apos;s use of AI to generate advice from my
          data.
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading || !agreed} className={buttonClass}>
          {loading ? "Saving..." : "Accept & continue"}
        </button>
      </form>
    </div>
  );
}
