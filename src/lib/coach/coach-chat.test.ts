import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { askCoach, type CoachChatContext } from "./coach-chat";
import { CRISIS_MARKER, CRISIS_REPLY } from "@/lib/crisis-response";

// Safety-audit fix (2026-09-06) — coach-chat.ts had no automated coverage
// at all, unlike Pod Assist's adversarial eval suite for the equivalent
// surface. These tests cover the two deterministic safety wrappers around
// the (mocked, never real) provider call — the crisis-marker interception
// and the banned-word bounded retry — not the model's actual output
// quality, matching how the rest of this app tests deterministic logic
// around a non-deterministic dependency.

function baseContext(): CoachChatContext {
  return {
    memberName: "Test Member",
    goal: "fitness",
    experienceLevel: "intermediate",
    blockState: { kind: "no_profile" },
    recoveryStatus: { kind: "not_connected" },
    lastSession: null,
    weeklyReview: {
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
      sessionsCompleted: 0,
      totalVolumeKg: 0,
      nutritionDaysLogged: 0,
      nutritionDaysInWindow: 7,
      avgDailyCalories: null,
      avgDailyProteinG: null,
      avgDailyCarbsG: null,
      avgDailyFatG: null,
      targets: null,
      totalSteps: null,
      avgRestingHeartRate: null,
      avgSleepMinutes: null,
      wearableDaysSynced: 0,
    },
    injuries: null,
    avoidedExerciseNames: [],
  };
}

function groqResponse(content: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) } as Response;
}

describe("askCoach", () => {
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    process.env.GROQ_API_KEY = originalGroqKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("never returns the raw crisis marker — always the fixed CRISIS_REPLY instead", async () => {
    global.fetch = vi.fn().mockResolvedValue(groqResponse(CRISIS_MARKER));
    const reply = await askCoach(baseContext(), "I don't want to be here anymore", []);
    expect(reply).toBe(CRISIS_REPLY);
    expect(reply).not.toContain(CRISIS_MARKER);
  });

  it("retries once when the banned word appears, and ships the retry's answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(groqResponse("Squats are a great functional exercise."))
      .mockResolvedValueOnce(groqResponse("Squats are a great compound exercise."));
    global.fetch = fetchMock;

    const reply = await askCoach(baseContext(), "What's a good leg exercise?", []);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reply).toBe("Squats are a great compound exercise.");
  });

  it("ships the retry's answer even if it still contains the banned word — one bounded retry, never a loop", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(groqResponse("That's a functional movement."))
      .mockResolvedValueOnce(groqResponse("Still a functional movement."));
    global.fetch = fetchMock;

    const reply = await askCoach(baseContext(), "Tell me about squats", []);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reply).toBe("Still a functional movement.");
  });

  it("does not retry when the first answer never used the banned word", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(groqResponse("Squats are a great compound exercise."));
    global.fetch = fetchMock;

    const reply = await askCoach(baseContext(), "What's a good leg exercise?", []);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reply).toBe("Squats are a great compound exercise.");
  });
});
