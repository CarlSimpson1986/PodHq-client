"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { WAIVER_TERMS, type WaiverBlock } from "@/lib/waiver-terms";

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

function TermsBlock({ block }: { block: WaiverBlock }) {
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

export function AccessWaiverForm({ initialSignedName }: { initialSignedName: string }) {
  const router = useRouter();
  const [signedName, setSignedName] = useState(initialSignedName);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/access/waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedName, agreed }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      router.push("/profile?access=complete");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-h-96 overflow-y-auto rounded-xl border border-card-light-border p-4">
        {WAIVER_TERMS.map((block, i) => (
          <TermsBlock key={i} block={block} />
        ))}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="signedName" className="mb-1.5 block text-sm text-card-light-muted">
            Type your full name to sign
          </label>
          <input
            id="signedName"
            type="text"
            autoComplete="name"
            required
            className={inputClass}
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-card-light-muted">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-card-light-border"
          />
          I have read and agree to My Fit Pod&apos;s Terms &amp; Conditions, House Rules and the Waiver above.
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading || !agreed} className={buttonClass}>
          {loading ? "Signing..." : "Sign & agree"}
        </button>
      </form>
    </div>
  );
}
