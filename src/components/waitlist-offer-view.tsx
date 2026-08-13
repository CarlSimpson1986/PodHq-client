"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WaitlistEntry } from "@/lib/waitlist/types";

function formatSlot(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function WaitlistOfferView({ entry }: { entry: WaitlistEntry | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"accepted" | "declined" | null>(null);

  if (!entry) {
    return <p className="text-sm text-card-light-muted">This offer doesn&apos;t exist or isn&apos;t yours.</p>;
  }

  const isExpired = !entry.offer_expires_at || new Date(entry.offer_expires_at) < new Date();
  const isLive = entry.status === "offered" && !isExpired;

  async function act(action: "accept" | "decline") {
    if (pending || !entry) return;
    setError(null);
    setPending(action);
    try {
      const res = await fetch(`/api/waitlist/${entry.id}/${action}`, { method: "POST" });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      setResult(action === "accept" ? "accepted" : "declined");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(null);
    }
  }

  if (result === "accepted") {
    return <p className="text-sm text-success">You&apos;re booked in — see you then!</p>;
  }
  if (result === "declined") {
    return <p className="text-sm text-card-light-muted">No problem — the next person on the waitlist has been offered this spot.</p>;
  }

  const { day, time } = formatSlot(entry.slot_start);

  if (!isLive) {
    return (
      <p className="text-sm text-card-light-muted">
        {entry.status === "accepted"
          ? "You already accepted this offer."
          : entry.status === "declined"
            ? "You declined this offer."
            : "This offer has expired — it's been passed to the next person on the waitlist."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-card-light-border p-4">
        <p className="text-sm font-semibold text-card-light-foreground">{day}</p>
        <p className="text-sm text-card-light-muted">{time} — {entry.gym}</p>
      </div>
      <p className="text-sm text-card-light-muted">
        You have 15 minutes to claim this spot before it&apos;s offered to the next person. Accepting uses 1 credit.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => act("accept")}
          disabled={!!pending}
          className="flex-1 rounded-lg bg-card-light-foreground px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending === "accept" ? "Claiming..." : "Accept"}
        </button>
        <button
          onClick={() => act("decline")}
          disabled={!!pending}
          className="flex-1 rounded-lg border border-card-light-border px-4 py-2.5 text-sm font-semibold text-card-light-muted hover:text-card-light-foreground disabled:opacity-50"
        >
          {pending === "decline" ? "..." : "Not now"}
        </button>
      </div>
    </div>
  );
}
