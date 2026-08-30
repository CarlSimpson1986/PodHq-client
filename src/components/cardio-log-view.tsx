"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CardioEquipment } from "@/lib/coach/cardio-equipment";

// Binary log, no duration/distance this stage — tapping a named machine
// logs a single tick, same simplicity as a habit tick (daily-habits-card.tsx).
export function CardioLogView({ equipment }: { equipment: CardioEquipment[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLog(equipmentId: number) {
    setError(null);
    setBusyId(equipmentId);
    try {
      const res = await fetch("/api/member/cardio-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Could not log that. Try again.");
        return;
      }
      router.push("/");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (equipment.length === 0) {
    return (
      <div className="card-light p-5">
        <p className="text-sm text-card-light-muted">Your gym hasn&apos;t listed any cardio equipment yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="space-y-2">
        {equipment.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busyId !== null}
            onClick={() => handleLog(item.id)}
            className="card-light block w-full p-4 text-left text-sm font-medium disabled:opacity-50"
          >
            {busyId === item.id ? "Logging..." : item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
