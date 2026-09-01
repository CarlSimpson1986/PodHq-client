"use client";

import { useEffect, useRef, useState } from "react";
import { MEALS, MEAL_LABELS, type Meal, type NutritionTrackingMode } from "@/lib/coach/types";
import { gramsToPortions } from "@/lib/coach/portions";

interface NutritionTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

interface FoodLogEntry {
  id: number;
  meal: Meal;
  foodName: string;
  brand: string | null;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface DayTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface FoodOption {
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: string;
}

type SheetTab = "recent" | "search" | "scan" | "custom";

const inputClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

function todayString() {
  // Matches the server's Europe/London logged_date default closely enough
  // for date-nav purposes — the server is the source of truth for what
  // "today" means when actually saving an entry.
  return new Date().toLocaleDateString("en-CA");
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

// Diary review skews backward-looking (mostly "what did I eat"), unlike
// Book's forward-only window — 13 days back plus a few days forward gives
// enough scroll room without the strip defaulting to mostly-empty future
// days. Same drag-to-scroll pattern as booking-grid.tsx's day strip (Carl
// asked for it to look like Book's, 2026-08-27), adapted from that
// component's Link-based version to this one's button/setState model.
const NUTRITION_WINDOW_DAYS_BACK = 13;
const NUTRITION_WINDOW_DAYS_FORWARD = 3;

function nutritionWindowDates(): string[] {
  const today = todayString();
  const dates: string[] = [];
  for (let i = -NUTRITION_WINDOW_DAYS_BACK; i <= NUTRITION_WINDOW_DAYS_FORWARD; i++) {
    dates.push(addDays(today, i));
  }
  return dates;
}

function formatWeekday(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" });
}

function formatDayNumber(dateStr: string): string {
  return String(Number(dateStr.slice(-2)));
}

export function NutritionView({
  targets: initialTargets,
  trackingMode = "calorie_counting",
}: {
  targets: NutritionTargets | null;
  trackingMode?: NutritionTrackingMode;
}) {
  const [date, setDate] = useState(todayString());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [totals, setTotals] = useState<DayTotals>({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  const [targets, setTargets] = useState<NutritionTargets | null>(initialTargets);
  const [loading, setLoading] = useState(true);
  const [sheetMeal, setSheetMeal] = useState<Meal | null>(null);
  const windowDates = nutritionWindowDates();
  const selectedDayRef = useRef<HTMLButtonElement>(null);
  const dayStripRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  function onDayStripPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = dayStripRef.current;
    if (!el) return;
    dragState.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  }

  function onDayStripPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = dayStripRef.current;
    if (!el || !dragState.current.down) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 3) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startScroll - dx;
  }

  function onDayStripPointerUp() {
    dragState.current.down = false;
    setTimeout(() => {
      dragState.current.moved = false;
    }, 0);
  }

  function onDayButtonClick(d: string) {
    if (dragState.current.moved) return;
    setDate(d);
  }

  async function loadDay(d: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/member/nutrition/day?date=${d}`);
      const body = await res.json();
      if (body.status === "ok") {
        setEntries(body.entries);
        setTotals(body.totals);
        setTargets(body.targets);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // queueMicrotask defers past the effect body itself — loadDay's first
    // statement is setLoading(true), a synchronous setState the effect
    // rule otherwise flags (same pattern podHq's promo-codes-view.tsx uses
    // for its own load-on-prop-change effect).
    queueMicrotask(() => loadDay(date));
  }, [date]);

  // Same reasoning as booking-grid.tsx's identical effect: landing on a
  // non-default date (or just scrolling the strip away from today) would
  // otherwise leave the real selection off-screen with nothing indicating
  // there's more to scroll to.
  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [date]);

  const remaining = targets ? targets.calories - totals.calories : null;

  return (
    <>
      {/* Own hero + white card, same pattern as booking-grid.tsx — the date
          strip needs to live in the dark hero to match Book's placement
          and colours (bg-foreground/text-background), not the white card
          it was wrongly nested inside originally (found live 2026-08-27,
          Carl: "can you see the difference i want uniformity"). */}
      <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">Nutrition</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your daily diary</p>
        </div>
        <div
          ref={dayStripRef}
          onPointerDown={onDayStripPointerDown}
          onPointerMove={onDayStripPointerMove}
          onPointerUp={onDayStripPointerUp}
          onPointerLeave={onDayStripPointerUp}
          onPointerCancel={onDayStripPointerUp}
          className="scrollbar-hide mx-auto mt-6 flex w-full max-w-md cursor-grab gap-2 overflow-x-auto pb-1 active:cursor-grabbing"
        >
          {windowDates.map((d) => {
            const isSelected = d === date;
            return (
              <button
                key={d}
                ref={isSelected ? selectedDayRef : undefined}
                type="button"
                onClick={() => onDayButtonClick(d)}
                className={`flex shrink-0 select-none flex-col items-center rounded-lg px-3 py-2 text-center ${
                  isSelected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card-border"
                }`}
              >
                <span className="text-xs uppercase">{formatWeekday(d)}</span>
                <span className="text-base font-semibold tabular-nums">{formatDayNumber(d)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light space-y-6 p-6">
          {targets ? (
            trackingMode === "hand_portions" ? (
              <PortionsSummary consumed={totals} target={targets} />
            ) : (
              <>
                <CalorieRing target={targets.calories} consumed={totals.calories} remaining={remaining!} />
                <div className="grid grid-cols-3 gap-3">
                  <MacroBar label="Protein" consumed={totals.proteinG} target={targets.proteinG} />
                  <MacroBar label="Carbs" consumed={totals.carbsG} target={targets.carbsG} />
                  <MacroBar label="Fat" consumed={totals.fatG} target={targets.fatG} />
                </div>
              </>
            )
          ) : (
            <div className="rounded-xl border border-card-light-border p-5">
              <p className="text-sm font-semibold">Body stats needed</p>
              <p className="mt-1 text-sm text-card-light-muted">
                Your weight, height and age from onboarding are needed to work out your daily targets.
              </p>
            </div>
          )}

          {loading ? (
            <p className="text-center text-sm text-card-light-muted">Loading...</p>
          ) : (
            <div className="space-y-4">
              {MEALS.map((meal) => (
                <MealSection
                  key={meal}
                  meal={meal}
                  entries={entries.filter((e) => e.meal === meal)}
                  onAdd={() => setSheetMeal(meal)}
                  onDelete={async (id) => {
                    await fetch(`/api/member/nutrition/log/${id}`, { method: "DELETE" });
                    loadDay(date);
                  }}
                />
              ))}
            </div>
          )}

          {targets && <MealSuggestionsCard date={date} trackingMode={trackingMode} onAdded={() => loadDay(date)} />}
        </div>
      </div>

      {sheetMeal && (
        <AddFoodSheet
          meal={sheetMeal}
          onClose={() => setSheetMeal(null)}
          onLogged={() => {
            setSheetMeal(null);
            loadDay(date);
          }}
        />
      )}
    </>
  );
}

function CalorieRing({ target, consumed, remaining }: { target: number; consumed: number; remaining: number }) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (consumed / target) * 100)) : 0;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-card-light-border" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-accent transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-semibold">{Math.round(Math.abs(remaining)).toLocaleString("en-GB")}</p>
          <p className="text-xs text-card-light-muted">{remaining >= 0 ? "kcal left" : "kcal over"}</p>
        </div>
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, target }: { label: string; consumed: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  return (
    <div className="rounded-xl border border-card-light-border p-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold">
        {Math.round(consumed)}
        <span className="text-card-light-muted">/{target}g</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-light-border">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PortionCount({ label, emoji, count, target }: { label: string; emoji: string; count: number; target: number }) {
  const whole = Math.floor(count);
  const half = count - whole >= 0.5;
  const totalSlots = Math.max(target, Math.ceil(count));
  const slots = Array.from({ length: totalSlots }, (_, i) => {
    if (i < whole) return 1;
    if (i === whole && half) return 0.5;
    return 0;
  });

  return (
    <div className="rounded-xl border border-card-light-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">{label}</p>
        <p className="text-sm font-semibold">
          {count} / {target}
        </p>
      </div>
      <p className="mt-1 text-lg" aria-hidden>
        {slots.map((v, i) => (
          <span key={i} style={{ opacity: v === 1 ? 1 : v === 0.5 ? 0.6 : 0.25 }}>
            {emoji}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

// The Nutrition tab's "hand portions" mode (2026-08-25 redesign) — same
// day totals as calorie-counting mode, converted via gramsToPortions
// instead of shown as grams/kcal. Meal-by-meal logging underneath stays
// identical either way; only this day-level summary differs.
function PortionsSummary({ consumed, target }: { consumed: DayTotals; target: NutritionTargets }) {
  const consumedPortions = gramsToPortions(consumed.proteinG, consumed.carbsG, consumed.fatG);
  const targetPortions = gramsToPortions(target.proteinG, target.carbsG, target.fatG);

  return (
    <div className="space-y-3">
      <PortionCount label="Protein (palm)" emoji="🖐️" count={consumedPortions.palms} target={targetPortions.palms} />
      <PortionCount label="Carbs (cupped hand)" emoji="🫲" count={consumedPortions.cuppedHands} target={targetPortions.cuppedHands} />
      <PortionCount label="Fat (thumb)" emoji="👍" count={consumedPortions.thumbs} target={targetPortions.thumbs} />
    </div>
  );
}

interface MealSuggestion {
  meal: Meal;
  name: string;
  description: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  instructions: string[];
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

// "What to eat next" — real composed meals from the hand-written
// MEAL_CATALOG (see meal-suggestions.ts), prioritised toward whichever
// meal slot(s) haven't been logged today yet, so this reads as an actual
// next-meal suggestion rather than two random items. "Regenerate" just
// re-fetches, since the server already randomises among its
// top-scoring candidates each call.
function MealSuggestionsCard({
  date,
  trackingMode,
  onAdded,
}: {
  date: string;
  trackingMode: NutritionTrackingMode;
  onAdded: () => void;
}) {
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Portion scaling for suggestions (2026-08-26) — previously "+ Add"
  // logged the catalog's fixed serving straight away with no way to
  // adjust it, unlike search/barcode/custom, which already went through
  // QuantityStep. Reuses that same component instead of a bespoke
  // duplicate, pre-filled at the catalog's own suggested grams rather
  // than QuantityStep's normal 100g default.
  const [adjusting, setAdjusting] = useState<MealSuggestion | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/member/nutrition/suggestions?date=${date}`);
      const body = await res.json();
      if (body.status === "ok") setSuggestions(body.suggestions);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!loading && suggestions.length === 0) return null;

  if (adjusting) {
    return (
      <div className="rounded-xl border border-card-light-border bg-accent/5 p-4">
        <QuantityStep
          meal={adjusting.meal}
          food={{
            name: adjusting.name,
            brand: null,
            caloriesPer100g: adjusting.caloriesPer100g,
            proteinPer100g: adjusting.proteinPer100g,
            carbsPer100g: adjusting.carbsPer100g,
            fatPer100g: adjusting.fatPer100g,
            source: "manual",
          }}
          initialQuantity={adjusting.quantityG}
          loggedDate={date}
          onBack={() => setAdjusting(null)}
          onLogged={() => {
            setAdjusting(null);
            onAdded();
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-card-light-border bg-accent/5 p-4">
      <p className="text-sm font-semibold">What to eat next</p>
      {loading ? (
        <p className="mt-2 text-sm text-card-light-muted">Loading suggestions...</p>
      ) : (
        <div className="mt-3 space-y-2">
          {suggestions.map((s) => {
            const isExpanded = expanded === s.name;
            return (
              <div key={s.name} className="rounded-lg bg-white/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">{MEAL_LABELS[s.meal]}</p>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-card-light-muted">{s.description}</p>
                    <p className="mt-0.5 text-xs text-card-light-muted">
                      {trackingMode === "hand_portions" ? (
                        (() => {
                          const p = gramsToPortions(s.proteinG, s.carbsG, s.fatG);
                          return `${p.palms} palm, ${p.cuppedHands} cupped hand, ${p.thumbs} thumb`;
                        })()
                      ) : (
                        `${s.calories} kcal · P${s.proteinG}g C${s.carbsG}g F${s.fatG}g`
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdjusting(s)}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                  >
                    + Add
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : s.name)}
                  className="mt-2 text-xs font-semibold text-accent"
                >
                  {isExpanded ? "Hide recipe ▲" : "View recipe ▼"}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-2 border-t border-card-light-border pt-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Ingredients</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-card-light-foreground">
                        {s.ingredients.map((ing, i) => (
                          <li key={i}>{ing}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Method</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-card-light-foreground">
                        {s.instructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" onClick={load} className="text-xs font-semibold text-accent">
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

function MealSection({
  meal,
  entries,
  onAdd,
  onDelete,
}: {
  meal: Meal;
  entries: FoodLogEntry[];
  onAdd: () => void;
  onDelete: (id: number) => void;
}) {
  const subtotal = entries.reduce((sum, e) => sum + e.calories, 0);
  return (
    <div className="rounded-xl border border-card-light-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{MEAL_LABELS[meal]}</p>
        <div className="flex items-center gap-3">
          {entries.length > 0 && <p className="text-xs text-card-light-muted">{Math.round(subtotal)} kcal</p>}
          <button type="button" onClick={onAdd} className="text-sm font-semibold text-accent">
            + Add
          </button>
        </div>
      </div>
      {entries.length > 0 && (
        <ul className="mt-3 space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <div>
                <p>{e.foodName}</p>
                <p className="text-xs text-card-light-muted">
                  {e.quantityG}g{e.brand ? ` · ${e.brand}` : ""} · {Math.round(e.calories)} kcal
                </p>
              </div>
              <button type="button" onClick={() => onDelete(e.id)} className="px-2 text-card-light-muted" aria-label="Delete entry">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddFoodSheet({ meal, onClose, onLogged }: { meal: Meal; onClose: () => void; onLogged: () => void }) {
  const [tab, setTab] = useState<SheetTab>("recent");
  const [selected, setSelected] = useState<FoodOption | null>(null);
  const [customInitialName, setCustomInitialName] = useState("");

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card-light p-6 text-card-light-foreground sm:rounded-2xl">
        {selected ? (
          <QuantityStep meal={meal} food={selected} onBack={() => setSelected(null)} onLogged={onLogged} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add to {MEAL_LABELS[meal]}</h2>
              <button type="button" onClick={onClose} className="text-card-light-muted" aria-label="Close">
                ×
              </button>
            </div>

            <div className="mt-4 flex gap-2 border-b border-card-light-border">
              {(["recent", "search", "scan", "custom"] as SheetTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-2 text-sm font-medium capitalize ${
                    tab === t ? "border-b-2 border-card-light-foreground text-card-light-foreground" : "text-card-light-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "recent" && <RecentTab onSelect={setSelected} />}
              {tab === "search" && (
                <SearchTab
                  onSelect={setSelected}
                  onCustom={(name) => {
                    setCustomInitialName(name);
                    setTab("custom");
                  }}
                />
              )}
              {tab === "scan" && <ScanTab onSelect={setSelected} />}
              {tab === "custom" && (
                <CustomFoodForm initialName={customInitialName} onBack={() => setTab("search")} onCreated={setSelected} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RecentTab({ onSelect }: { onSelect: (f: FoodOption) => void }) {
  const [recent, setRecent] = useState<FoodOption[] | null>(null);

  useEffect(() => {
    fetch("/api/member/nutrition/recent")
      .then((r) => r.json())
      .then((body) => {
        if (body.status === "ok") {
          setRecent(
            body.recent.map((r: FoodOption & { foodName?: string }) => ({
              name: r.foodName ?? r.name,
              brand: r.brand,
              caloriesPer100g: r.caloriesPer100g,
              proteinPer100g: r.proteinPer100g,
              carbsPer100g: r.carbsPer100g,
              fatPer100g: r.fatPer100g,
              source: r.source,
            }))
          );
        }
      });
  }, []);

  if (recent === null) return <p className="text-sm text-card-light-muted">Loading...</p>;
  if (recent.length === 0) return <p className="text-sm text-card-light-muted">Nothing logged yet — try Search instead.</p>;

  return (
    <ul className="space-y-2">
      {recent.map((f, i) => (
        <FoodResultRow key={i} food={f} onSelect={() => onSelect(f)} />
      ))}
    </ul>
  );
}

function SearchTab({ onSelect, onCustom }: { onSelect: (f: FoodOption) => void; onCustom: (initialName: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      queueMicrotask(() => {
        setResults([]);
        setHasSearched(false);
      });
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const res = await fetch(`/api/member/nutrition/food-search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        if (body.status === "ok") {
          setResults(body.results);
          setHasSearched(true);
        }
      } catch {
        // aborted or failed — leave previous results in place
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const noResults = hasSearched && !searching && results.length === 0;

  return (
    <div>
      <input
        type="text"
        className={inputClass}
        placeholder="Search for a food (min 3 characters)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p className="mt-2 text-xs text-card-light-muted">Searching...</p>}
      <ul className="mt-3 space-y-2">
        {results.map((f, i) => (
          <FoodResultRow key={i} food={f} onSelect={() => onSelect(f)} />
        ))}
      </ul>
      {noResults && (
        <div className="mt-3 rounded-lg border border-dashed border-card-light-border p-4 text-center">
          <p className="text-sm text-card-light-muted">Nothing found for &quot;{query.trim()}&quot;.</p>
          <button type="button" onClick={() => onCustom(query.trim())} className="mt-2 text-sm font-semibold text-accent">
            Create a custom food →
          </button>
        </div>
      )}
    </div>
  );
}

function CustomFoodForm({
  initialName,
  onBack,
  onCreated,
}: {
  initialName: string;
  onBack: () => void;
  onCreated: (f: FoodOption) => void;
}) {
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const canSubmit = name.trim().length > 0 && calories !== "" && protein !== "" && carbs !== "" && fat !== "";

  function handleSubmit() {
    onCreated({
      name: name.trim(),
      brand: brand.trim() || null,
      caloriesPer100g: Number(calories),
      proteinPer100g: Number(protein),
      carbsPer100g: Number(carbs),
      fatPer100g: Number(fat),
      source: "manual",
    });
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="text-sm text-card-light-muted">
        ← Back
      </button>
      <p className="text-sm font-semibold">Create a custom food</p>
      <p className="text-xs text-card-light-muted">
        Enter values per 100g — you&apos;ll set the actual quantity on the next step. It&apos;ll show up under Recent next time
        too.
      </p>
      <input type="text" className={inputClass} placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        type="text"
        className={inputClass}
        placeholder="Brand (optional)"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          inputMode="decimal"
          className={inputClass}
          placeholder="Calories /100g"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <input
          type="number"
          inputMode="decimal"
          className={inputClass}
          placeholder="Protein /100g"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
        />
        <input
          type="number"
          inputMode="decimal"
          className={inputClass}
          placeholder="Carbs /100g"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
        />
        <input
          type="number"
          inputMode="decimal"
          className={inputClass}
          placeholder="Fat /100g"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
        />
      </div>
      <button type="button" disabled={!canSubmit} onClick={handleSubmit} className={buttonClass}>
        Continue →
      </button>
    </div>
  );
}

// Chrome's native BarcodeDetector API isn't implemented on any iOS
// browser (Safari or otherwise) as of writing, which would silently
// leave scanning unavailable for roughly half of UK mobile members — so
// this uses html5-qrcode instead, a library that decodes frames itself
// (jsQR/zxing-js under the hood via canvas, not a native browser API) and
// works the same way on iOS Safari, Android Chrome, and desktop.
// Dynamically imported so its ~230KB isn't in the main bundle for members
// who never open the Scan tab.
const BARCODE_READER_ID = "nutrition-barcode-reader";

function ScanTab({ onSelect }: { onSelect: (f: FoodOption) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Structural type, not `import("html5-qrcode").Html5Qrcode` — an inline
  // type-only import of a dynamically-imported package broke Next's
  // client-component boundary transform (NutritionView's own import
  // resolved to a Promise<undefined> at render time, before ScanTab ever
  // ran). Only .stop() is actually called on this ref.
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  async function handleBarcode(barcode: string) {
    // The scanner can fire its success callback more than once before
    // stop() resolves — null the ref first so a second near-simultaneous
    // detection is a no-op instead of double-fetching/double-selecting.
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    await scanner.stop().catch(() => {});
    setScanning(false);
    const res = await fetch(`/api/member/nutrition/barcode/${barcode}`);
    const body = await res.json();
    if (body.status === "ok") {
      onSelect({
        name: body.result.name,
        brand: body.result.brand,
        caloriesPer100g: body.result.caloriesPer100g,
        proteinPer100g: body.result.proteinPer100g,
        carbsPer100g: body.result.carbsPer100g,
        fatPer100g: body.result.fatPer100g,
        source: body.result.source,
      });
    } else {
      setError("Product not found — try Search instead.");
    }
  }

  async function startScan() {
    setError(null);
    setScanning(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(BARCODE_READER_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          handleBarcode(decodedText);
        },
        () => {
          // per-frame decode miss — expected constantly while aiming, ignore
        }
      );
    } catch {
      setScanning(false);
      setError("Camera access denied or unavailable.");
    }
  }

  return (
    <div className="space-y-3">
      {!scanning && (
        <button type="button" onClick={startScan} className={buttonClass}>
          Start camera
        </button>
      )}
      <div id={BARCODE_READER_ID} className={scanning ? "overflow-hidden rounded-lg" : "hidden"} />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

const COOKED_FORM_PATTERN = /\b(cooked|boiled|steamed|grilled|roasted|baked|fried|poached|stewed|braised|made up with)\b/i;
const RAW_FORM_PATTERN = /\b(raw|uncooked)\b/i;

// Same food weighed dry/raw vs. cooked can have wildly different
// kcal/100g (cooking oats or rice in water roughly triples-to-quadruples
// their weight without adding calories, so the cooked form's per-100g
// figure looks "wrong" if you're not expecting it — Carl, 2026-08-25,
// hit exactly this with two separate "Porridge oats" entries). Flagging
// the prep form as a visible pill next to the kcal figure rather than
// leaving it buried in a long food name, so it's obvious at a glance
// which one you're picking.
function describePrepForm(name: string): "Cooked" | "Raw" | null {
  if (COOKED_FORM_PATTERN.test(name)) return "Cooked";
  if (RAW_FORM_PATTERN.test(name)) return "Raw";
  return null;
}

function FoodResultRow({ food, onSelect }: { food: FoodOption; onSelect: () => void }) {
  const prepForm = describePrepForm(food.name);
  return (
    <li>
      <button type="button" onClick={onSelect} className="w-full rounded-lg border border-card-light-border p-3 text-left">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{food.name}</p>
          {prepForm && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                prepForm === "Cooked" ? "bg-warning/15 text-warning" : "bg-card-light-border text-card-light-muted"
              }`}
            >
              {prepForm}
            </span>
          )}
        </div>
        <p className="text-xs text-card-light-muted">
          {food.brand ? `${food.brand} · ` : ""}
          {Math.round(food.caloriesPer100g)} kcal / 100g
        </p>
      </button>
    </li>
  );
}

function QuantityStep({
  meal,
  food,
  initialQuantity,
  loggedDate,
  onBack,
  onLogged,
}: {
  meal: Meal;
  food: FoodOption;
  // Meal suggestions (MealSuggestionsCard) open this pre-filled at the
  // catalog's own suggested serving (e.g. 250g) rather than resetting to
  // a generic 100g — 2026-08-26, portions previously couldn't be scaled
  // at all from that card, this is the same scaling step search/barcode/
  // custom already had, just given a sensible starting point instead of
  // always 100.
  initialQuantity?: number;
  // Only meal suggestions pass this — search/barcode/custom (via
  // AddFoodSheet) have never sent it and always log to today, unrelated
  // pre-existing behaviour this fix isn't touching. Meal suggestions
  // already respected whichever date was being viewed before this
  // change, so that still needs to reach the log API here too.
  loggedDate?: string;
  onBack: () => void;
  onLogged: () => void;
}) {
  const [quantity, setQuantity] = useState(initialQuantity ?? 100);
  const [logging, setLogging] = useState(false);
  const factor = quantity / 100;

  async function handleLog() {
    setLogging(true);
    try {
      await fetch("/api/member/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal,
          foodName: food.name,
          brand: food.brand ?? "",
          quantityG: quantity,
          caloriesPer100g: food.caloriesPer100g,
          proteinPer100g: food.proteinPer100g,
          carbsPer100g: food.carbsPer100g,
          fatPer100g: food.fatPer100g,
          source: food.source,
          ...(loggedDate ? { loggedDate } : {}),
        }),
      });
      onLogged();
    } finally {
      setLogging(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-card-light-muted">
        ← Back
      </button>
      <h2 className="mt-2 text-lg font-semibold">{food.name}</h2>
      {food.brand && <p className="text-sm text-card-light-muted">{food.brand}</p>}

      <label htmlFor="quantity" className="mb-1.5 mt-4 block text-sm text-card-light-muted">
        Quantity (g)
      </label>
      <input
        id="quantity"
        type="number"
        inputMode="numeric"
        className={inputClass}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />

      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
        <div>
          <p className="font-semibold">{Math.round(food.caloriesPer100g * factor)}</p>
          <p className="text-xs text-card-light-muted">kcal</p>
        </div>
        <div>
          <p className="font-semibold">{Math.round(food.proteinPer100g * factor)}g</p>
          <p className="text-xs text-card-light-muted">Protein</p>
        </div>
        <div>
          <p className="font-semibold">{Math.round(food.carbsPer100g * factor)}g</p>
          <p className="text-xs text-card-light-muted">Carbs</p>
        </div>
        <div>
          <p className="font-semibold">{Math.round(food.fatPer100g * factor)}g</p>
          <p className="text-xs text-card-light-muted">Fat</p>
        </div>
      </div>

      <button type="button" onClick={handleLog} disabled={logging || quantity <= 0} className={`${buttonClass} mt-6`}>
        {logging ? "Logging..." : "Log it"}
      </button>
    </div>
  );
}
