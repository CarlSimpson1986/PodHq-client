"use client";

import { useState } from "react";

// "More information" inquiry, not instant slot booking (Carl's own call,
// modelled on Solo60's PT tab) — sends a lead to staff to arrange
// directly, rather than a calendar/availability system per trainer.
export function ProfessionalInquiryForm({ professionalId, professionalName }: { professionalId: number; professionalName: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    if (pending || !message.trim()) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/member/professional-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId, message: message.trim() }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Could not send that. Try again.");
        return;
      }
      setSent(true);
      setMessage("");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="card-light p-5">
        <p className="text-sm font-semibold text-success">Sent</p>
        <p className="mt-1 text-sm text-card-light-muted">
          {professionalName} will be in touch to arrange things — hang tight.
        </p>
      </div>
    );
  }

  return (
    <div className="card-light p-5">
      <p className="text-sm font-semibold">More information</p>
      <p className="mt-1 text-sm text-card-light-muted">Tell {professionalName} what your goals are, your available times and your budget.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="e.g. I want to build strength, free most weekday evenings, budget around £X/session..."
        className="mt-3 w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={send}
        disabled={pending || !message.trim()}
        className="mt-3 w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
