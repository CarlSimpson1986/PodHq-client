"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProfessionalSummary } from "@/lib/data/professionals";
import { GYM_NAMES } from "@/lib/gym";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function ProfessionalsDirectory({ professionals }: { professionals: ProfessionalSummary[] }) {
  const [query, setQuery] = useState("");
  const [gym, setGym] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return professionals.filter((p) => {
      const matchesQuery = q === "" || p.name.toLowerCase().includes(q) || p.specialties.some((s) => s.toLowerCase().includes(q));
      const matchesGym = gym === "" || p.gyms.includes(gym as (typeof GYM_NAMES)[number]);
      return matchesQuery && matchesGym;
    });
  }, [professionals, query, gym]);

  return (
    <div className="space-y-4">
      <div className="card-light space-y-3 p-5">
        <input
          type="text"
          placeholder="Search by name or specialty"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-base text-card-light-foreground placeholder:text-card-light-muted focus:border-card-light-foreground focus:outline-none"
        />
        <select
          value={gym}
          onChange={(e) => setGym(e.target.value)}
          className="w-full rounded-lg border border-card-light-border bg-white px-3 py-2 text-sm text-card-light-foreground"
        >
          <option value="">All gyms</option>
          {GYM_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          {professionals.length === 0 ? "No professionals listed yet." : "No professionals match your search."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/professionals/${p.id}`} prefetch={false} className="card-light block p-4 text-center">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external hosted URLs Carl pastes in, not app-owned assets worth Next/Image's optimisation pipeline
                <img src={p.photoUrl} alt={p.name} className="mx-auto h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-card-light-border text-lg font-semibold">
                  {initials(p.name)}
                </div>
              )}
              <p className="mt-2 text-sm font-semibold">{p.name}</p>
              <p className="mt-0.5 text-xs text-card-light-muted">{p.specialties.slice(0, 2).join(", ") || "Personal Trainer"}</p>
              <p className="mt-1 text-sm font-semibold text-card-light-foreground">£{p.pricePerHourGbp.toFixed(0)}/hr</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
