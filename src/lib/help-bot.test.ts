import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { askHelpBot } from "./help-bot";
import { CRISIS_MARKER, CRISIS_REPLY, MEDICAL_EMERGENCY_MARKER, MEDICAL_EMERGENCY_REPLY } from "@/lib/crisis-response";

// Found in the 2026-09-07 pre-launch review: help-bot.ts (and
// crisis-response.ts, covered indirectly via this file and
// coach-chat.test.ts) had zero automated coverage at all. Same convention
// as coach-chat.test.ts — these cover the deterministic marker-
// interception wrapper around the (mocked, never real) provider call, not
// the model's actual output quality; the adversarial eval suite
// (evals/chat-safety.eval.ts) covers real-model behaviour separately.
vi.mock("@/lib/data/help-faq", () => ({
  getFaqItems: vi.fn().mockResolvedValue([{ question: "How do I cancel?", answer: "Cancel up to 3 hours before your session." }]),
}));

function groqResponse(content: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) } as Response;
}

describe("askHelpBot", () => {
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
    const { reply, needsStaff } = await askHelpBot("I don't want to be here anymore", []);
    expect(reply).toBe(CRISIS_REPLY);
    expect(reply).not.toContain(CRISIS_MARKER);
    expect(needsStaff).toBe(false);
  });

  it("never returns the raw medical-emergency marker — always the fixed MEDICAL_EMERGENCY_REPLY instead", async () => {
    global.fetch = vi.fn().mockResolvedValue(groqResponse(MEDICAL_EMERGENCY_MARKER));
    const { reply, needsStaff } = await askHelpBot("my chest feels tight and I can't breathe properly", []);
    expect(reply).toBe(MEDICAL_EMERGENCY_REPLY);
    expect(reply).not.toContain(MEDICAL_EMERGENCY_MARKER);
    expect(needsStaff).toBe(false);
  });

  it("strips the unresolved-question marker from the reply and flags needsStaff", async () => {
    global.fetch = vi.fn().mockResolvedValue(groqResponse("I'm not sure about that policy, ask gym staff.\n<<STAFF_FOLLOWUP>>"));
    const { reply, needsStaff } = await askHelpBot("What's your policy on bringing a guest?", []);
    expect(needsStaff).toBe(true);
    expect(reply).not.toContain("<<STAFF_FOLLOWUP>>");
    expect(reply).toBe("I'm not sure about that policy, ask gym staff.");
  });

  it("does not flag needsStaff for an ordinary answered question", async () => {
    global.fetch = vi.fn().mockResolvedValue(groqResponse("Cancel up to 3 hours before your session to avoid losing the credit."));
    const { reply, needsStaff } = await askHelpBot("How do I cancel?", []);
    expect(needsStaff).toBe(false);
    expect(reply).toBe("Cancel up to 3 hours before your session to avoid losing the credit.");
  });
});
