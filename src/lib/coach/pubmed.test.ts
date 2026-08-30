import { describe, it, expect } from "vitest";
import { extractCitedPmids, sanitizeCitedPmids } from "./pubmed";

describe("extractCitedPmids", () => {
  it("returns an empty set for the no-results message", () => {
    expect(extractCitedPmids("No relevant PubMed results found. Answer using general evidence-based framing instead — do not invent a citation.").size).toBe(0);
  });

  it("collects every PMID present in a formatted tool result", () => {
    const formatted = '[PMID 111] A, B (2021). "Title one" Journal.\nAbstract: x\n\n[PMID 222] C, D (2022). "Title two" Journal.\nAbstract: y';
    expect(extractCitedPmids(formatted)).toEqual(new Set(["111", "222"]));
  });
});

describe("sanitizeCitedPmids", () => {
  it("leaves a citation tag that matches a known PMID untouched", () => {
    const reply = "A 2021 study found X boosts Y. [PMID 111] Aim for 3-5g daily.";
    expect(sanitizeCitedPmids(reply, new Set(["111"]))).toBe(reply);
  });

  it("strips a citation tag the tool never returned", () => {
    const reply = "A 2021 study found X boosts Y. [PMID 999] Aim for 3-5g daily.";
    expect(sanitizeCitedPmids(reply, new Set(["111"]))).toBe("A 2021 study found X boosts Y. Aim for 3-5g daily.");
  });

  it("strips every tag when no search was actually performed", () => {
    const reply = "A 2021 study found X boosts Y. [PMID 999] Aim for 3-5g daily.";
    expect(sanitizeCitedPmids(reply, new Set())).toBe("A 2021 study found X boosts Y. Aim for 3-5g daily.");
  });

  it("keeps a real tag and strips a fabricated one in the same reply", () => {
    const reply = "Study A found X. [PMID 111] Study B found Y too. [PMID 999] Do Z.";
    expect(sanitizeCitedPmids(reply, new Set(["111"]))).toBe("Study A found X. [PMID 111] Study B found Y too. Do Z.");
  });
});
