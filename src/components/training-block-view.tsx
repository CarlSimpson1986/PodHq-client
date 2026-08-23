"use client";

import { useCallback, useEffect, useState } from "react";

type BlockType = "hypertrophy" | "strength" | "deload";

type TrainingBlockState =
  | { kind: "no_profile" }
  | { kind: "in_block"; blockType: BlockType; startedAt: string; weeksRemaining: number; daysRemaining: number }
  | { kind: "transition_due"; currentBlockType: BlockType; scheduledNextBlockType: BlockType };

type BlockChangeRecommendation =
  | { kind: "shift"; nextBlockType: BlockType }
  | { kind: "keep"; reason: "low_attendance" }
  | { kind: "extend_deload"; reason: "high_fatigue" };

const BLOCK_LABELS: Record<BlockType, string> = {
  hypertrophy: "Hypertrophy",
  strength: "Strength",
  deload: "Deload",
};

const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  hypertrophy: "Higher-rep training, built around muscle growth.",
  strength: "Lower-rep, heavier compound-focused training.",
  deload: "A lighter week — reduced weight and sets — to recover before the next phase.",
};

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";
const secondaryButtonClass =
  "w-full rounded-lg border border-card-light-border px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50";

export function TrainingBlockView() {
  const [state, setState] = useState<TrainingBlockState | null>(null);
  const [recommendation, setRecommendation] = useState<BlockChangeRecommendation | null>(null);
  const [allowedBlockTypes, setAllowedBlockTypes] = useState<BlockType[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<BlockType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/member/training-block");
      const body = await res.json();
      if (body.status === "ok") {
        setState(body.state);
        setRecommendation(body.recommendation);
        setAllowedBlockTypes(body.allowedBlockTypes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  async function handleConfirm(chosenBlockType: BlockType) {
    setConfirming(chosenBlockType);
    setError(null);
    try {
      const res = await fetch("/api/member/training-block/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chosenBlockType }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Something went wrong.");
        return;
      }
      await load();
    } finally {
      setConfirming(null);
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-card-light-muted">Loading...</p>;
  }

  if (!state || state.kind === "no_profile") {
    return null;
  }

  if (state.kind === "in_block") {
    return (
      <div className="rounded-xl border border-card-light-border p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Current block</p>
        <p className="mt-1 text-lg font-semibold">{BLOCK_LABELS[state.blockType]}</p>
        <p className="mt-1 text-sm text-card-light-muted">{BLOCK_DESCRIPTIONS[state.blockType]}</p>
        <p className="mt-3 text-sm font-semibold">
          {state.daysRemaining} {state.daysRemaining === 1 ? "day" : "days"} until program change
        </p>
      </div>
    );
  }

  // transition_due
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-warning/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-warning">Program change ready</p>
        <p className="mt-1 text-sm text-card-light-muted">
          Your {BLOCK_LABELS[state.currentBlockType]} block has run its course.
        </p>
      </div>

      {recommendation && (
        <div className="rounded-xl border border-card-light-border p-5">
          {recommendation.kind === "shift" && (
            <>
              <p className="text-sm font-semibold">Suggested: move to {BLOCK_LABELS[recommendation.nextBlockType]}</p>
              <p className="mt-1 text-sm text-card-light-muted">{BLOCK_DESCRIPTIONS[recommendation.nextBlockType]}</p>
            </>
          )}
          {recommendation.kind === "keep" && (
            <>
              <p className="text-sm font-semibold">Suggested: stay in {BLOCK_LABELS[state.currentBlockType]}</p>
              <p className="mt-1 text-sm text-card-light-muted">
                A few sessions were missed this block — worth making the most of it before moving on.
              </p>
            </>
          )}
          {recommendation.kind === "extend_deload" && (
            <>
              <p className="text-sm font-semibold">Suggested: extend the deload</p>
              <p className="mt-1 text-sm text-card-light-muted">
                Recent sessions have felt hard — an extra recovery week before Strength.
              </p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="space-y-2">
        {recommendation?.kind === "shift" && (
          <>
            <button
              type="button"
              onClick={() => handleConfirm(recommendation.nextBlockType)}
              disabled={confirming !== null}
              className={buttonClass}
            >
              {confirming === recommendation.nextBlockType ? "Saving..." : `Shift to ${BLOCK_LABELS[recommendation.nextBlockType]}`}
            </button>
            {allowedBlockTypes.includes(state.currentBlockType) && (
              <button
                type="button"
                onClick={() => handleConfirm(state.currentBlockType)}
                disabled={confirming !== null}
                className={secondaryButtonClass}
              >
                {confirming === state.currentBlockType ? "Saving..." : `Keep training ${BLOCK_LABELS[state.currentBlockType]}`}
              </button>
            )}
          </>
        )}
        {recommendation?.kind === "keep" && (
          <button
            type="button"
            onClick={() => handleConfirm(state.currentBlockType)}
            disabled={confirming !== null}
            className={buttonClass}
          >
            {confirming === state.currentBlockType ? "Saving..." : `Continue with ${BLOCK_LABELS[state.currentBlockType]}`}
          </button>
        )}
        {recommendation?.kind === "extend_deload" && (
          <button
            type="button"
            onClick={() => handleConfirm(state.currentBlockType)}
            disabled={confirming !== null}
            className={buttonClass}
          >
            {confirming === state.currentBlockType ? "Saving..." : "Extend deload"}
          </button>
        )}
      </div>
    </div>
  );
}
