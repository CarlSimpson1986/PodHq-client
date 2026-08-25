"use client";

import { useState } from "react";

interface LeaderboardEntry {
  memberId: number;
  displayName: string;
  value: number;
  isSelf: boolean;
}

interface LeaderboardData {
  sessions: LeaderboardEntry[];
  streaks: LeaderboardEntry[];
  steps: LeaderboardEntry[];
}

const BOARD_DISPLAY_LIMIT = 10;

function Board({ title, entries, unit }: { title: string; entries: LeaderboardEntry[]; unit: (value: number) => string }) {
  if (entries.length === 0) {
    return (
      <div className="card-glass p-5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">Nobody&apos;s on this board yet — be the first.</p>
      </div>
    );
  }

  const top = entries.slice(0, BOARD_DISPLAY_LIMIT);
  const selfIndex = entries.findIndex((e) => e.isSelf);
  const selfOutsideTop = selfIndex >= BOARD_DISPLAY_LIMIT;

  return (
    <div className="card-glass p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {top.map((entry, i) => (
          <li
            key={entry.memberId}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${entry.isSelf ? "bg-accent/10" : ""}`}
          >
            <span className="flex items-center gap-2">
              <span className="w-5 text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <span className={entry.isSelf ? "font-semibold text-accent" : "text-foreground"}>
                {entry.displayName}
                {entry.isSelf ? " (you)" : ""}
              </span>
            </span>
            <span className="font-semibold text-foreground tabular-nums">{unit(entry.value)}</span>
          </li>
        ))}
      </ul>
      {selfOutsideTop && (
        <p className="mt-3 border-t border-card-border pt-2 text-xs text-muted-foreground">
          Your rank: #{selfIndex + 1} · {unit(entries[selfIndex].value)}
        </p>
      )}
    </div>
  );
}

export function LeaderboardView({
  initialOptedIn,
  initialSessions,
  initialStreaks,
  initialSteps,
}: {
  initialOptedIn: boolean;
  initialSessions: LeaderboardEntry[];
  initialStreaks: LeaderboardEntry[];
  initialSteps: LeaderboardEntry[];
}) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [data, setData] = useState<LeaderboardData>({ sessions: initialSessions, streaks: initialStreaks, steps: initialSteps });
  const [toggling, setToggling] = useState(false);

  async function refresh() {
    const res = await fetch("/api/member/leaderboard");
    const body = await res.json();
    if (body.status === "ok") {
      setData({ sessions: body.sessions, streaks: body.streaks, steps: body.steps });
      setOptedIn(body.optedIn);
    }
  }

  async function toggleOptIn() {
    setToggling(true);
    try {
      await fetch("/api/member/leaderboard/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: !optedIn }),
      });
      await refresh();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-glass p-5">
        {optedIn ? (
          <>
            <p className="text-sm font-semibold text-success">You&apos;re on the leaderboard</p>
            <p className="mt-1 text-sm text-muted-foreground">Shown as your first name + last initial to other members, every gym.</p>
            <button
              type="button"
              onClick={toggleOptIn}
              disabled={toggling}
              className="mt-3 text-xs font-semibold text-muted-foreground underline disabled:opacity-50"
            >
              {toggling ? "Leaving..." : "Leave the leaderboard"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">Join the leaderboard</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You can see everyone&apos;s boards already — opt in to appear on them yourself, as your first name + last initial. Off by default, leave any time.
            </p>
            <button
              type="button"
              onClick={toggleOptIn}
              disabled={toggling}
              className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              {toggling ? "Joining..." : "Join the leaderboard"}
            </button>
          </>
        )}
      </div>

      <Board title="Sessions this month" entries={data.sessions} unit={(v) => `${v}`} />
      <Board title="Current streak" entries={data.streaks} unit={(v) => `${v}wk`} />
      <Board title="Steps this week" entries={data.steps} unit={(v) => v.toLocaleString("en-GB")} />
    </div>
  );
}
