"use client";

import { useState } from "react";
import { RECOMMENDED_HABITS } from "@/lib/coach/habit-catalog";
import type { HabitType } from "@/lib/coach/types";
import type { MemberHabit } from "@/lib/coach/daily-habits";

type Habit = MemberHabit & { todayCount: number };

const buttonClass = "rounded-lg border border-card-light-border px-3 py-2 text-left text-sm font-medium hover:bg-card-border/10";

// The daily habit checklist — lives in two places (2026-08-29): embedded
// (no card chrome, `embedded` prop) inside Home's collapsible
// TodaysMissionCard for day-to-day ticking, and standalone (own
// `card-light` wrapper) on /coach/profile for setup/management, so a new
// premium member has somewhere to configure habits before Home ever shows
// them a populated list. Same list/tick/add state either way — only the
// outer wrapper differs. Deliberately separate from /dashboard's weekly
// "Sessions" card (coexists, doesn't replace, per the 2026-08-28 scoping).
export function DailyHabitsCard({ initialHabits, embedded = false }: { initialHabits: Habit[]; embedded?: boolean }) {
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [adding, setAdding] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<HabitType>("checkbox");
  const [customTarget, setCustomTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/member/habits");
    const body = await res.json();
    if (body.status === "ok") setHabits(body.habits);
  }

  async function tick(habit: Habit) {
    if (busy) return;
    setBusy(true);
    setError(null);
    // Optimistic — a habit tick is low-stakes and this keeps the tap
    // feeling instant; refresh() below reconciles with the real state
    // right after.
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, todayCount: h.todayCount + 1 } : h)));
    try {
      const res = await fetch(`/api/member/habits/${habit.id}/tick`, { method: "POST" });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Couldn't update that. Try again.");
      }
      await refresh();
    } catch {
      setError("Couldn't update that. Try again.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function untick(habit: Habit) {
    if (busy || habit.todayCount === 0) return;
    setBusy(true);
    setError(null);
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, todayCount: Math.max(0, h.todayCount - 1) } : h)));
    try {
      const res = await fetch(`/api/member/habits/${habit.id}/untick`, { method: "POST" });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Couldn't update that. Try again.");
      }
      await refresh();
    } catch {
      setError("Couldn't update that. Try again.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeHabit(habit: Habit) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/member/habits/${habit.id}`, { method: "DELETE" });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Couldn't remove that. Try again.");
        return;
      }
      setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    } catch {
      setError("Couldn't remove that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdd(name: string, habitType: HabitType, targetCount: number | null) {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/member/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), habitType, targetCount: targetCount ?? undefined }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Couldn't add that habit. Try again.");
        return;
      }
      setCustomName("");
      setCustomTarget("");
      setCustomType("checkbox");
      setAdding(false);
      await refresh();
    } catch {
      setError("Couldn't add that habit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const availableRecommended = RECOMMENDED_HABITS.filter((r) => !habits.some((h) => h.name === r.name));

  return (
    <div className={embedded ? "" : "card-light p-5"}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Daily habits</p>

      {habits.length === 0 && !adding && (
        <p className="text-sm text-card-light-muted">Nothing set up yet — add a habit to start tracking it day to day.</p>
      )}

      <ul className="space-y-2">
        {habits.map((habit) => {
          const done = habit.habitType === "checkbox" ? habit.todayCount > 0 : habit.todayCount >= (habit.targetCount ?? 1);
          return (
            <li key={habit.id} className="flex items-center justify-between gap-3 rounded-lg border border-card-light-border px-3 py-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => tick(habit)}
                className="flex flex-1 items-center gap-2.5 text-left disabled:opacity-50"
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs ${
                    done ? "border-success bg-success text-white" : "border-card-light-border"
                  }`}
                >
                  {done ? "✓" : ""}
                </span>
                <span className="text-sm">{habit.name}</span>
              </button>

              <div className="flex items-center gap-2">
                {habit.habitType === "counted" && (
                  <span className="text-xs font-medium text-card-light-muted">
                    {habit.todayCount}/{habit.targetCount}
                  </span>
                )}
                {habit.todayCount > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => untick(habit)}
                    className="text-xs text-card-light-muted underline disabled:opacity-50"
                  >
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeHabit(habit)}
                  aria-label={`Remove ${habit.name}`}
                  className="text-card-light-muted hover:text-danger disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-xs font-semibold underline">
          + Add habit
        </button>
      ) : (
        <div className="mt-3 space-y-3 border-t border-card-light-border pt-3">
          {availableRecommended.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-card-light-muted">Recommended</p>
              <div className="flex flex-wrap gap-2">
                {availableRecommended.map((r) => (
                  <button
                    key={r.name}
                    type="button"
                    disabled={busy}
                    onClick={() => submitAdd(r.name, r.habitType, r.targetCount ?? null)}
                    className={buttonClass}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs text-card-light-muted">Or add your own</p>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Habit name"
              maxLength={80}
              className="w-full rounded-lg border border-card-light-border bg-white px-3 py-2 text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomType("checkbox")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  customType === "checkbox" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border"
                }`}
              >
                Yes/no
              </button>
              <button
                type="button"
                onClick={() => setCustomType("counted")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  customType === "counted" ? "border-card-light-foreground bg-card-light-foreground text-white" : "border-card-light-border"
                }`}
              >
                Count towards a target
              </button>
              {customType === "counted" && (
                <input
                  type="number"
                  inputMode="numeric"
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  placeholder="Target"
                  min={1}
                  max={999}
                  className="w-20 rounded-lg border border-card-light-border bg-white px-2 py-1.5 text-xs text-card-light-foreground focus:border-card-light-foreground focus:outline-none"
                />
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy || !customName.trim() || (customType === "counted" && !customTarget)}
                onClick={() => submitAdd(customName, customType, customType === "counted" ? Number(customTarget) : null)}
                className="rounded-lg bg-card-light-foreground px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-card-light-muted underline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
